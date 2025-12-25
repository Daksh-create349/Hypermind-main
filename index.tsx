import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    afterSignOutUrl="/"
    appearance={{
      baseTheme: dark,
      variables: {
        colorPrimary: '#ffffff',
        colorBackground: '#020817',
        colorText: '#ffffff',
        colorInputBackground: '#0f172a',
        colorInputText: '#ffffff',
        borderRadius: '0.5rem',
        fontFamily: '"Inter", sans-serif'
      },
      elements: {
        formButtonPrimary: {
          backgroundColor: 'white',
          color: 'black',
          "&:hover": {
            backgroundColor: '#e5e5e5'
          }
        },
        card: "bg-neutral-950 border border-neutral-800 shadow-xl",
        headerTitle: "text-white",
        headerSubtitle: "text-neutral-400",
        formFieldLabel: "text-neutral-300",
        formFieldInput: "bg-neutral-900 border-neutral-700 text-white focus:border-white transition-colors",
        footer: "space-y-2",
        footerActionLink: "text-white hover:text-neutral-300 font-medium ml-1",
        socialButtonsBlockButton: "bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800",
        socialButtonsBlockButtonText: "text-white",
        dividerLine: "bg-neutral-800",
        dividerText: "text-neutral-500",
        form: "text-white"
      }
    }}
  >
    <App />
  </ClerkProvider>
);