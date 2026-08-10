import { useCallback, useMemo, useState } from '@lynx-js/react';

export interface PreviewRoute {
  id: string;
  closable?: boolean;
}

export function usePreviewRouter<Route extends PreviewRoute>(
  initialRoutes: Route[],
  initialRouteId: string,
) {
  const [routes, setRoutes] = useState<Route[]>(initialRoutes);
  const [activeRouteId, setActiveRouteId] = useState(initialRouteId);
  const [isOpen, setIsOpen] = useState(false);

  const activeRoute = useMemo(
    () => routes.find((route) => route.id === activeRouteId) ?? routes[0],
    [activeRouteId, routes],
  );

  const openRoute = useCallback((route: Route) => {
    setRoutes((current) => current.some((candidate) => candidate.id === route.id)
      ? current
      : [...current, route]);
    setActiveRouteId(route.id);
    setIsOpen(true);
  }, []);

  const activateRoute = useCallback((routeId: string) => {
    setActiveRouteId(routeId);
    setIsOpen(true);
  }, []);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);
  const close = useCallback(() => setIsOpen(false), []);

  const closeRoute = useCallback((routeId: string) => {
    setRoutes((current) => {
      const remaining = current.filter((route) => route.id !== routeId);
      setActiveRouteId((active) => active === routeId ? remaining[0]?.id ?? initialRouteId : active);
      if (remaining.length === 0) setIsOpen(false);
      return remaining;
    });
  }, [initialRouteId]);

  const reset = useCallback(() => {
    setRoutes(initialRoutes);
    setActiveRouteId(initialRouteId);
    setIsOpen(false);
  }, [initialRouteId, initialRoutes]);

  return {
    routes,
    activeRoute,
    activeRouteId,
    isOpen,
    openRoute,
    activateRoute,
    closeRoute,
    toggle,
    close,
    reset,
  };
}
