import React, { useState, useEffect } from 'react';
import { SplineSceneBasic } from './components/SplineSceneBasic';
import { Onboarding } from './components/Onboarding';

import { ChatInterface } from './components/ChatInterface';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spotlight } from './components/ui/spotlight';
import { BrainCircuit, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useUser, SignedIn, SignedOut } from '@clerk/clerk-react';
import { CouncilInterface } from './components/council/CouncilInterface';
import { CouncilSetup } from './components/council/CouncilSetup';
import { AgentConfig } from './lib/council/types';
import { cn } from './lib/utils';


export default function App() {
    const { isSignedIn, user, isLoaded } = useUser();
    const [hasStarted, setHasStarted] = useState(false);
    const [isOnboarded, setIsOnboarded] = useState(false);
    const [dbUser, setDbUser] = useState<any>(null);
    const [showLanding, setShowLanding] = useState(true);
    const [showChoice, setShowChoice] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [forceShowOnboarding, setForceShowOnboarding] = useState(false);

    // Council State
    const [showCouncil, setShowCouncil] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [councilConfig, setCouncilConfig] = useState<AgentConfig[]>([]);
    const [councilTopic, setCouncilTopic] = useState("");
    const [councilContext, setCouncilContext] = useState("");

    // Sync User with Backend when Signed In
    useEffect(() => {
        // Log state execution for debugging
        console.log("App Auth State:", { isLoaded, isSignedIn, hasUser: !!user });

        if (isLoaded && isSignedIn && user) {
            // Background sync is primary for data retrieval
            const syncUser = async () => {
                try {
                    const res = await fetch('/api/user/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: user.primaryEmailAddress?.emailAddress,
                            clerkId: user.id,
                            name: user.fullName,
                            image: user.imageUrl,
                            provider: 'clerk'
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setDbUser(data);

                        // Check if they are already onboarded
                        const isUserOnboarded = !!(data?.onboarding?.qualification);
                        setIsOnboarded(isUserOnboarded);

                        if (isUserOnboarded) {
                            // Only show choice if we haven't already moved to the dashboard in this session
                            setShowChoice(true);

                            // Increment session count
                            fetch('/api/user/progress', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: user.primaryEmailAddress?.emailAddress,
                                    progress: { totalSessions: (data.progress?.totalSessions || 0) + 1 }
                                })
                            }).catch(() => { });
                        }
                    }
                } catch (error) {
                    console.error("Sync error (non-fatal):", error);
                }
            };

            syncUser();
        }
    }, [isLoaded, isSignedIn, user]); // Removed hasStarted from deps to prevent loops

    const handleStart = React.useCallback(() => {
        setHasStarted(true);
        setTimeout(() => setShowLanding(false), 1200);
    }, []);

    const handleOnboardingComplete = async (data: any) => {
        setIsOnboarded(true);
        // Immediate local update for UI
        setDbUser((prev: any) => ({ ...prev, onboarding: data }));

        if (isSignedIn && user) {
            try {
                await fetch('/api/user/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.primaryEmailAddress?.emailAddress,
                        data: data
                    })
                });
            } catch (e) {
                console.error("Failed to save onboarding", e);
            }
        }
    };

    if (!isLoaded) {
        return (
            <div className="h-screen w-full bg-black flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
                    <p className="text-neutral-500 text-sm animate-pulse">Initializing HyperMind...</p>
                </div>
            </div>
        );
    }

    // We keep the sync logic, but move the UI control to Clerk components
    return (
        <div className="h-screen w-full bg-black flex overflow-hidden relative selection:bg-white/30">
            {/* Global Background Spotlight */}
            <Spotlight className="-top-40 left-0 opacity-40 z-0" fill="white" />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative z-10 p-0">
                <main className="flex-1 overflow-hidden p-0 flex flex-col relative w-full h-full">

                    {/* SHOW LANDING ONLY WHEN SIGNED OUT */}
                    <SignedOut>
                        <div className="absolute inset-0 z-30">
                            <SplineSceneBasic onStart={() => { }} />
                        </div>
                    </SignedOut>

                    {/* SHOW DASHBOARD ONLY WHEN SIGNED IN */}
                    <SignedIn>
                        <ErrorBoundary>
                            {(!isOnboarded || showChoice) && !forceShowOnboarding ? (
                                <div className="absolute inset-0 z-30">
                                    <SplineSceneBasic
                                        onStart={() => {
                                            if (!isOnboarded) setForceShowOnboarding(true);
                                        }}
                                        isLoggedIn={true}
                                        returningUser={showChoice}
                                        dbUser={dbUser}
                                        onContinue={(subj) => {
                                            setSelectedSubject(subj);
                                            setIsOnboarded(true);
                                            setShowChoice(false);
                                            setHasStarted(true);
                                            setShowLanding(false);
                                        }}
                                        onStartFresh={async () => {
                                            if (user?.primaryEmailAddress?.emailAddress) {
                                                await fetch('/api/user/reset', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ email: user.primaryEmailAddress.emailAddress })
                                                });
                                            }
                                            setIsOnboarded(false);
                                            setShowChoice(false);
                                            setDbUser(null);
                                            setForceShowOnboarding(true);
                                        }}
                                    />
                                </div>
                            ) : forceShowOnboarding ? (
                                <div className="flex-1 min-h-0 animate-in fade-in zoom-in-95 duration-700 p-6 md:p-8">
                                    <Onboarding onComplete={(data) => {
                                        setForceShowOnboarding(false);
                                        handleOnboardingComplete(data);
                                    }} />
                                </div>
                            ) : (
                                <div className="flex h-full w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    <div className="flex-1 h-full relative flex flex-col min-w-0 bg-neutral-950">
                                        <ChatInterface
                                            mode="learn"
                                            userData={{ ...dbUser, ...user, selectedSubject }}
                                            onLaunchCouncil={() => setShowSetup(true)}
                                        />
                                    </div>
                                </div>
                            )}
                        </ErrorBoundary>
                    </SignedIn>

                </main>
            </div>

            {/* Council Modals */}
            {showSetup && (
                <CouncilSetup
                    userProfile={{ ...dbUser, ...user }}
                    onCancel={() => setShowSetup(false)}
                    onStart={(config, topic, context) => {
                        setCouncilConfig(config);
                        setCouncilTopic(topic);
                        setCouncilContext(context);
                        setShowSetup(false);
                        setShowCouncil(true);
                    }}
                />
            )}

            {showCouncil && (
                <CouncilInterface
                    topic={councilTopic}
                    context={councilContext}
                    initialAgents={councilConfig}
                    userProfile={{ ...dbUser, ...user }}
                    onClose={() => setShowCouncil(false)}
                />
            )}
        </div>
    );
}