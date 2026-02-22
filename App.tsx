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
    const [selectedJourney, setSelectedJourney] = useState<any>(null);
    const [journeys, setJourneys] = useState<any[]>([]);
    const [forceShowOnboarding, setForceShowOnboarding] = useState(false);

    // Council State
    const [showCouncil, setShowCouncil] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [councilConfig, setCouncilConfig] = useState<AgentConfig[]>([]);
    const [councilTopic, setCouncilTopic] = useState("");
    const [councilContext, setCouncilContext] = useState("");

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);

    // Sync User with Backend when Signed In
    useEffect(() => {
        // Log state execution for debugging
        console.log("App Auth State:", { isLoaded, isSignedIn, hasUser: !!user });

        if (isLoaded && isSignedIn && user) {
            setIsSyncing(true);
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

                        // Fetch Journeys
                        const journeysRes = await fetch(`/api/journeys?email=${user.primaryEmailAddress?.emailAddress}`);
                        if (journeysRes.ok) {
                            const journeysData = await journeysRes.json();
                            setJourneys(journeysData);

                            // Check if they are already onboarded
                            const isUserOnboarded = journeysData.length > 0;
                            setIsOnboarded(isUserOnboarded);

                            if (isUserOnboarded) {
                                setShowChoice(true);

                                // Increment session count for user
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
                    }
                } catch (error) {
                    console.error("Sync error (non-fatal):", error);
                } finally {
                    setIsSyncing(false);
                    setDataLoaded(true);
                }
            };

            syncUser();
        } else if (isLoaded && !isSignedIn) {
            setDataLoaded(true);
            setIsSyncing(false);
        }
    }, [isLoaded, isSignedIn, user]);

    const handleStart = React.useCallback(() => {
        setHasStarted(true);
        setTimeout(() => setShowLanding(false), 1200);
    }, []);

    const handleOnboardingComplete = async (data: any) => {
        if (isSignedIn && user) {
            try {
                const res = await fetch('/api/user/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.primaryEmailAddress?.emailAddress,
                        data: data
                    })
                });

                if (res.ok) {
                    const result = await res.json();
                    setDbUser(result.user);
                    setSelectedJourney(result.journey);
                    setSelectedSubject(result.journey.subject);
                    setJourneys(prev => [result.journey, ...prev]);
                    setIsOnboarded(true);
                }
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
                            <SplineSceneBasic
                                onStart={() => { }}
                                isLoggedIn={false}
                            />
                        </div>
                    </SignedOut>

                    {/* SHOW DASHBOARD ONLY WHEN SIGNED IN */}
                    <SignedIn>
                        <ErrorBoundary>
                            {!dataLoaded ? (
                                <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white z-50">
                                    <div className="relative w-24 h-24 mb-6">
                                        <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                                        <div className="absolute inset-2 border-t-2 border-white/20 rounded-full animate-spin-slow"></div>
                                        <BrainCircuit className="absolute inset-0 m-auto text-indigo-500 animate-pulse" size={32} />
                                    </div>
                                    <p className="text-neutral-500 text-sm font-medium tracking-widest uppercase">Synchronizing Neural Link</p>
                                </div>
                            ) : (!isOnboarded || showChoice) && !forceShowOnboarding ? (
                                <div className="absolute inset-0 z-30">
                                    <SplineSceneBasic
                                        onStart={() => {
                                            // If they are already signed in but not onboarded, we should verify
                                            // they want to start onboarding.
                                            if (!isOnboarded) setForceShowOnboarding(true);
                                        }}
                                        isLoggedIn={true}
                                        returningUser={showChoice}
                                        dbUser={dbUser}
                                        journeys={journeys}
                                        onContinue={(journey) => {
                                            setSelectedJourney(journey);
                                            setSelectedSubject(journey.subject);
                                            setIsOnboarded(true);
                                            setShowChoice(false);
                                            setHasStarted(true);
                                            setShowLanding(false);
                                        }}
                                        onStartFresh={async () => {
                                            setIsOnboarded(false);
                                            setShowChoice(false);
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
                                            userData={{ ...dbUser, ...user, selectedSubject, selectedJourney }}
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