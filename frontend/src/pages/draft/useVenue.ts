import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { collaborationApi, projectVenueApi } from '../../api/endpoints';
import type { SetVenueRoomInput, SetVenuePlanInput, ProjectVenue } from '../../api/venueTypes';
import { useErrorToast } from '../../utils/errors';

/**
 * The job's room, and the drawing under it. It hangs off the job rather than off the draft in this browser,
 * because the room is a fact about the job - everyone who opens it should see the same hall - while the draft is
 * one person's work in progress. The record is made by the first measurement, so nothing here has to create it.
 */
export function useVenue(projectId: string | null) {
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const key = ['project-venue', projectId];

  const venue = useQuery({
    queryKey: key,
    queryFn: () => projectVenueApi.byProject(projectId!),
    enabled: !!projectId,
  });

  const put = (next: ProjectVenue) => queryClient.setQueryData(key, next);

  const setVenue = useMutation({
    mutationFn: (input: SetVenueRoomInput) => projectVenueApi.setRoom(projectId!, input),
    onSuccess: put,
    onError: showError,
  });

  const setPlanImage = useMutation({
    mutationFn: (input: SetVenuePlanInput) => projectVenueApi.setPlan(projectId!, input),
    onSuccess: put,
    onError: showError,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const attachment = await collaborationApi.uploadFile('Project', projectId!, file);
      const room = venue.data?.room;
      // A new drawing starts unscaled: whatever the last one was worth says nothing about this one.
      return projectVenueApi.setPlan(projectId!, {
        planAttachmentId: attachment.id,
        planMetresPerPixel: null,
        planOriginXM: room?.planOriginXM ?? 0,
        planOriginZM: room?.planOriginZM ?? 0,
        planRotationDeg: room?.planRotationDeg ?? 0,
      });
    },
    onSuccess: put,
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: () => projectVenueApi.removeRoom(projectId!),
    onSuccess: put,
    onError: showError,
  });

  return { loading: venue.isLoading, venue: venue.data?.room ?? null, setVenue, setPlanImage, upload, remove };
}

/**
 * The drawing itself, fetched with the session's token and handed back as a blob URL - an <img src> cannot carry
 * a bearer, and the file is not public.
 */
export function usePlanImage(attachmentId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachmentId) {
      setUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    void collaborationApi.download(attachmentId).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId]);

  return url;
}
