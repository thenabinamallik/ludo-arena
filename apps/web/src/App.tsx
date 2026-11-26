import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ArenaProvider } from './hooks/useRoomSession';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { GameConfigPage } from './pages/GameConfigPage';
import { GameHistoryPage } from './pages/GameHistoryPage';
import { HostDashboardPage } from './pages/HostDashboardPage';
import { JoinPage } from './pages/JoinPage';
import { LandingPage } from './pages/LandingPage';
import { MainBoardPage } from './pages/MainBoardPage';
import { MatchResultsPage } from './pages/MatchResultsPage';
import { PlayerControllerPage } from './pages/PlayerControllerPage';
import { PlayerRegisterPage } from './pages/PlayerRegisterPage';
import { SettingsRulesPage } from './pages/SettingsRulesPage';
import { SpectatorPage } from './pages/SpectatorPage';
import { TroubleshootPage } from './pages/TroubleshootPage';
import { WaitingLobbyPage } from './pages/WaitingLobbyPage';

export function App() {
  return (
    <ArenaProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/host/create" element={<CreateRoomPage />} />
          <Route path="/host/:roomId" element={<HostDashboardPage />} />
          <Route path="/host/:roomId/config" element={<GameConfigPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/:roomId" element={<JoinPage />} />
          <Route path="/join/:roomId/register" element={<PlayerRegisterPage />} />
          <Route path="/lobby/:roomId" element={<WaitingLobbyPage />} />
          <Route path="/board/:roomId" element={<MainBoardPage />} />
          <Route path="/play/:roomId" element={<PlayerControllerPage />} />
          <Route path="/spectate/:roomId" element={<SpectatorPage />} />
          <Route path="/results/:roomId" element={<MatchResultsPage />} />
          <Route path="/history" element={<GameHistoryPage />} />
          <Route path="/settings" element={<SettingsRulesPage />} />
          <Route path="/troubleshoot" element={<TroubleshootPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ArenaProvider>
  );
}
