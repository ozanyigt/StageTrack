import type { EquipmentFolder } from '../../api/types';

export interface FolderNode {
  key: string;
  value: string;
  title: string;
  children: FolderNode[];
}

/** Turns the flat folder list into the nested shape used by Tree and TreeSelect. */
export function buildFolderTree(folders: EquipmentFolder[], parentId: string | null = null): FolderNode[] {
  return folders
    .filter((f) => (f.parentId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((f) => ({ key: f.id, value: f.id, title: f.name, children: buildFolderTree(folders, f.id) }));
}
