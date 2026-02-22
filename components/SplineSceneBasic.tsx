'use client'

import React, { useState, useEffect } from 'react'
import { SplineScene } from "./ui/spline";
import { Card } from "./ui/card"
import { Spotlight } from "./ui/spotlight"
import { ArrowRight, Mail, Lock, Github, ArrowLeft, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { SignIn, SignUp } from '@clerk/clerk-react';

interface Props {
    onStart: () => void;
    isLoggedIn?: boolean;
    returningUser?: boolean;
    dbUser?: any;
    onContinue?: (subject: string) => void;
    onStartFresh?: () => void;
}

export function SplineSceneBasic({ onStart, isLoggedIn, returningUser, dbUser, onContinue, onStartFresh }: Props) {
    const [step, setStep] = useState<'intro' | 'auth'>('intro');
    const [subStep, setSubStep] = useState<'default' | 'continue'>('default');
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

    // Removed local useEffect to avoid conflict with App.tsx logic

    const handleAuth = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoadingAuth(true);
        // Simulate auth delay then launch directly
        setTimeout(() => {
            setIsLoadingAuth(false);
            onStart();
        }, 1500);
    };


    return (
        <Card className="w-full h-full bg-black/[0.96] relative overflow-hidden border-neutral-800 flex flex-col shadow-2xl">
            <Spotlight
                className="-top-40 left-0 md:left-60 md:-top-20"
                fill="white"
            />

            <div className="relative w-full h-full flex flex-col md:block">

                {/* ROBOT CONTAINER */}
                {/* Intro: Right (left: 50%) | Auth: Left (left: 0) */}
                <div className={cn(
                    "relative h-[400px] md:h-full w-full md:w-[50%] transition-all duration-1000 ease-in-out z-0 will-change-transform",
                    step === 'intro' ? "md:translate-x-[100%]" : "md:translate-x-0"
                )}>
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent z-10 pointer-events-none" />
                    <div className={cn("w-full h-full transition-opacity duration-1000", step === 'intro' ? "opacity-90" : "opacity-60")}>
                        <SplineScene
                            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                            className="w-full h-full"
                        />
                    </div>
                </div>

                {/* INTRO TEXT (LEFT PANEL) */}
                {/* Visible when step is 'intro' */}
                <div className={cn(
                    "md:absolute inset-y-0 left-0 w-full md:w-[50%] p-8 md:p-16 flex flex-col justify-center transition-all duration-1000 ease-in-out z-10",
                    step === 'intro'
                        ? "opacity-100 translate-x-0 pointer-events-auto"
                        : "opacity-0 -translate-x-full pointer-events-none"
                )}>
                    <div className="flex flex-col justify-center h-full">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 w-fit mb-6">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-xs font-medium text-neutral-300">Adaptive Learning Engine</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white via-neutral-200 to-neutral-600 tracking-tight pb-2">
                            HyperMind
                        </h1>
                        <p className="mt-6 text-lg text-neutral-400 max-w-lg leading-relaxed">
                            {returningUser
                                ? "Welcome back, pick up where you left off or start a completely fresh learning voyage."
                                : "Your personal AI Learning Companion. Democratizing high-quality education with adaptive pathways."}
                        </p>


                        {returningUser ? (
                            <div className="mt-10 flex flex-col gap-4">
                                {subStep === 'continue' ? (
                                    <div className="space-y-4">
                                        <button
                                            onClick={() => setSubStep('default')}
                                            className="flex items-center gap-2 text-xs text-neutral-500 hover:text-white transition-colors mb-2"
                                        >
                                            <ArrowLeft size={14} /> Back to options
                                        </button>
                                        <div className="grid grid-cols-1 gap-2">
                                            {(dbUser?.onboarding?.subjects || []).map((subj: string) => (
                                                <button
                                                    key={subj}
                                                    onClick={() => {
                                                        setSelectedSubject(subj);
                                                        onContinue?.(subj);
                                                    }}
                                                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-between group"
                                                >
                                                    <span className="text-neutral-300 font-medium group-hover:text-white">{subj}</span>
                                                    <ArrowRight size={16} className="text-neutral-600 group-hover:text-white transition-transform group-hover:translate-x-1" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <button
                                            onClick={() => setSubStep('continue')}
                                            className="group relative w-fit flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-semibold text-lg hover:bg-neutral-100 transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                                        >
                                            Continue Learning
                                            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                                        </button>
                                        <button
                                            onClick={onStartFresh}
                                            className="group relative w-fit flex items-center gap-3 bg-neutral-900 border border-neutral-800 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-neutral-800 transition-all hover:scale-105 active:scale-95"
                                        >
                                            Start Fresh Path
                                            <Globe size={20} className="text-neutral-500 group-hover:text-indigo-400 transition-colors" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => isLoggedIn ? onStart() : setStep('auth')}
                                className="mt-10 group relative w-fit flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-semibold text-lg hover:bg-neutral-100 transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                            >
                                Start Learning
                                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                            </button>
                        )}
                    </div>
                </div>

                {/* AUTH (RIGHT PANEL) */}
                {/* Visible when step is 'auth' */}
                <div className={cn(
                    "md:absolute inset-y-0 right-0 w-full md:w-[50%] p-8 md:p-16 flex flex-col justify-center transition-all duration-1000 ease-in-out z-10",
                    step === 'auth'
                        ? "opacity-100 translate-x-0 pointer-events-auto"
                        : "opacity-0 translate-x-full pointer-events-none"
                )}>

                    {/* AUTH FORM */}
                    <div className={cn(
                        "absolute inset-0 p-8 md:p-16 flex flex-col justify-center transition-all duration-500",
                        step === 'auth' ? "opacity-100 scale-100 delay-500 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                    )}>
                        <div className="w-full max-w-md mx-auto">
                            <button
                                onClick={() => setStep('intro')}
                                className="flex items-center gap-2 text-neutral-500 hover:text-white mb-8 transition-colors group"
                            >
                                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
                            </button>

                            <div className="w-full flex justify-center">
                                {step === 'auth' && (
                                    <div className="w-full relative">
                                        {/* Container for smooth transition */}
                                        <div className="transition-all duration-500 ease-in-out">
                                            {authMode === 'signin' ? (
                                                <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                                                    <SignIn
                                                        appearance={{
                                                            elements: {
                                                                footer: "hidden",
                                                                card: "bg-transparent shadow-none w-full",
                                                            }
                                                        }}
                                                    />
                                                    <div className="mt-4 text-center text-neutral-400 text-sm">
                                                        Don't have an account?{' '}
                                                        <button
                                                            onClick={() => setAuthMode('signup')}
                                                            className="text-white hover:underline font-medium hover:text-indigo-400 transition-colors"
                                                        >
                                                            Sign up
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                                    <SignUp
                                                        appearance={{
                                                            elements: {
                                                                footer: "hidden",
                                                                card: "bg-transparent shadow-none w-full",
                                                            }
                                                        }}
                                                    />
                                                    <div className="mt-4 text-center text-neutral-400 text-sm">
                                                        Already have an account?{' '}
                                                        <button
                                                            onClick={() => setAuthMode('signin')}
                                                            className="text-white hover:underline font-medium hover:text-indigo-400 transition-colors"
                                                        >
                                                            Sign in
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </Card>
    )
}