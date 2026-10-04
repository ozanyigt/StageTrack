namespace StageTrack.Inventory;

public class EquipmentFolderManager(
    IEquipmentFolderRepository folderRepository,
    IEquipmentRepository equipmentRepository)
{
    public async Task<EquipmentFolder> CreateAsync(string name, Guid? parentId)
    {
        if (parentId.HasValue)
        {
            await folderRepository.GetAsync(parentId.Value, includeDetails: false);
        }

        var sortOrder = await folderRepository.GetMaxSortOrderAsync(parentId) + 1;
        return new EquipmentFolder(Guid.CreateVersion7(), name.Trim(), parentId, sortOrder);
    }

    public async Task MoveAsync(EquipmentFolder folder, Guid? newParentId)
    {
        if (newParentId.HasValue)
        {
            var all = await folderRepository.GetListAsync();
            if (newParentId == folder.Id || GetDescendantIds(all, folder.Id).Contains(newParentId.Value))
            {
                throw new BusinessException(StageTrackErrorCodes.FolderCycle);
            }
        }

        folder.SetParent(newParentId);
    }

    public async Task EnsureCanDeleteAsync(EquipmentFolder folder)
    {
        if (await folderRepository.HasChildrenAsync(folder.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.FolderHasChildren);
        }

        if (await equipmentRepository.AnyInFolderAsync(folder.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.FolderHasEquipment);
        }
    }

    /// <summary>The folder itself plus every folder below it; used for "including subfolders" filters.</summary>
    public async Task<List<Guid>> GetSubtreeIdsAsync(Guid folderId)
    {
        var all = await folderRepository.GetListAsync();
        return [folderId, .. GetDescendantIds(all, folderId)];
    }

    private static HashSet<Guid> GetDescendantIds(IReadOnlyCollection<EquipmentFolder> all, Guid rootId)
    {
        var result = new HashSet<Guid>();
        var queue = new Queue<Guid>([rootId]);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            foreach (var child in all.Where(f => f.ParentId == current))
            {
                if (result.Add(child.Id))
                {
                    queue.Enqueue(child.Id);
                }
            }
        }

        return result;
    }
}
