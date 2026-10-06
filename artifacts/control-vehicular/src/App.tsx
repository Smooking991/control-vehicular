import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import NewTrip from '@/pages/new-trip';
import History from '@/pages/history';
import FuelPage from '@/pages/fuel';
import Vehicles from '@/pages/vehicles';
import Drivers from '@/pages/drivers';
import Maintenance from '@/pages/maintenance';
import SettingsPage from '@/pages/settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/viajes/nuevo" component={NewTrip} />
          <Route path="/historial" component={History} />
          <Route path="/combustible" component={FuelPage} />
          <Route path="/vehiculos" component={Vehicles} />
          <Route path="/conductores" component={Drivers} />
          <Route path="/mantenciones" component={Maintenance} />
          <Route path="/configuracion" component={SettingsPage} />
          <Route path="/acceso" component={Dashboard} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
