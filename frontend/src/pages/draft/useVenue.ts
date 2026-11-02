import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { collaborationApi, sitePlanApi } from '../../api/endpoints';
import type { SetSiteVenueInput, SetSiteVenuePlanInput, SitePlan } from '../../api/siteTypes';
import { useErrorToast } from '../../utils/errors';

/**
 * The job's room, and the drawing under it. It hangs off the job's site plan rather than off the draft in this
 * browser, because the room is a fact about the job - everyone who opens it should see the same hall - while the
 * draft is one person's work in progress. A job with no site plan yet gets one the moment a room is entered.
 */
export function useVenue(projectId: string | null) {
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const key = ['site-plan', projectId];

  const plan = useQuery({
    queryKey: key,
    queryFn: () => sitePlanApi.byProject(projectId!),
    enabled: !!projectId,
  });

  const put = (next: SitePlan) => queryClient.setQueryData(key, next);

  /** Entering a room on a job that has no plan yet makes the plan; the map side simply opens empty. */
  const planOf = async () => plan.data ?? (await sitePlanApi.create({ projectId: projectId!, centreLat: 39.9334, centreLng: 32.8597 }));

  const setVenue = useMutation({
    mutationFn: async (input: SetSiteVenueInput) => sitePlanApi.setVenue((await planOf()).id, input),
    onSuccess: put,
    onError: showError,
  });

  const setPlanImage = useMutation({
    mutationFn: async (input: SetSiteVenuePlanInput) => sitePlanApi.setVenuePlan((await planOf()).id, input),
    onSuccess: put,
    onError: showError,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const attachment = await collaborationApi.uploadFile('Project', projectId!, file);
      const current = await planOf();
      // A new drawing starts unscaled: whatever the last one was worth says nothing about this one.
      return sitePlanApi.setVenuePlan(current.id, {
        planAttachmentId: attachment.id,
        planMetresPerPixel: null,
        planOriginXM: current.venue?.planOriginXM ?? 0,
        planOriginZM: current.venue?.planOriginZM ?? 0,
        planRotationDeg: current.venue?.planRotationDeg ?? 0,
      });
    },
    onSuccess: put,
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: async () => sitePlanApi.removeVenue((await planOf()).id),
    onSuccess: put,
    onError: showError,
  });

  return { plan: plan.data ?? null, loading: plan.isLoading, venue: plan.data?.venue ?? null, setVenue, setPlanImage, upload, remove };
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
