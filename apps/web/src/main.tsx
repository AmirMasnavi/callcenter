import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import App from'./App';import'./styles.css';import'./filters.css';import'./usability.css';import'./tokens.css';import'./theme.css';import{initTheme}from'./lib/theme';
initTheme();
const client=new QueryClient({defaultOptions:{queries:{retry:1,staleTime:15000}}});
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><App/></QueryClientProvider></React.StrictMode>);
