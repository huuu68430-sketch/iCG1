import React from 'react';
import { GlobalPasswordPage } from './GlobalPasswordPage';

export interface UserAuthPageProps {
  onSuccess: (userData: { name: string; kickUsername: string; discord?: string; avatar?: string }) => void;
  onBack?: () => void;
}

export const UserAuthPage: React.FC<UserAuthPageProps> = ({ onSuccess, onBack }) => {
  return (
    <GlobalPasswordPage
      onSuccess={(_role) => {
        const stored = localStorage.getItem('iabs_user');
        const parsed = stored ? JSON.parse(stored) : {};
        onSuccess({
          name: parsed.display_name || parsed.kick_username || '',
          kickUsername: parsed.kick_username || '',
          discord: parsed.discord,
          avatar: parsed.avatar
        });
      }}
    />
  );
};
