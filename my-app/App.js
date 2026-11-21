import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import useAuth from './src/hooks/useAuth';
import Auth from './src/screens/Auth';
import Home from './src/screens/Home';
import layoutStyles from './src/styles/layouts';

function Main() {
  const { auth } = useAuth();

  if (auth === undefined) {
    return (
      <View style={layoutStyles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return auth ? <Home /> : <Auth />;
}

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <Main />
      </AuthProvider>
    </PaperProvider>
  );
}
