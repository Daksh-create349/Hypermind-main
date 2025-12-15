import React, { useRef } from 'react';
import { Download, Award, CheckCircle2 } from 'lucide-react';

interface CertificateProps {
    userName: string;
    courseName: string;
    completionDate: string;
}

export function Certificate({ userName, courseName, completionDate }: CertificateProps) {
    const certRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        // Simple print-to-pdf trigger for now
        window.print();
    };

    return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000">

            {/* Certificate Preview */}
            <div
                ref={certRef}
                className="relative w-full max-w-4xl aspect-[1.4/1] bg-black border-[20px] border-double border-neutral-800 p-12 text-center flex flex-col items-center justify-between shadow-2xl print:border-black print:shadow-none"
                style={{ fontFamily: 'serif' }} // Use serif for classic certificate look
            >
                {/* Decorative Corners */}
                <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-neutral-600 rounded-tl-3xl" />
                <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-neutral-600 rounded-tr-3xl" />
                <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-neutral-600 rounded-bl-3xl" />
                <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-neutral-600 rounded-br-3xl" />

                {/* Content */}
                <div className="space-y-4">
                    <div className="flex justify-center mb-6">
                        <Award size={64} className="text-neutral-300" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-widest text-white mb-2">Certificate</h1>
                    <h2 className="text-xl text-neutral-400 uppercase tracking-widest">of Completion</h2>
                </div>

                <div className="space-y-6 my-8">
                    <p className="text-neutral-500 text-lg italic">This is to certify that</p>
                    <p className="text-3xl md:text-5xl font-bold text-white border-b border-neutral-800 pb-4 px-12 inline-block min-w-[300px]">
                        {userName}
                    </p>
                    <p className="text-neutral-500 text-lg italic">has successfully completed the premium curriculum in</p>
                    <p className="text-2xl md:text-3xl font-bold text-neutral-200">
                        {courseName}
                    </p>
                </div>

                <div className="w-full flex justify-between items-end mt-12 px-12">
                    <div className="text-center">
                        <p className="text-neutral-300 font-bold border-t border-neutral-700 pt-2 w-48 mx-auto">{completionDate}</p>
                        <p className="text-neutral-600 text-xs uppercase tracking-wider mt-1">Date</p>
                    </div>

                    <div className="mb-4">
                        <div className="w-24 h-24 rounded-full border-4 border-neutral-700 flex items-center justify-center opacity-50 rotate-[-15deg]">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase text-center leading-tight">HyperMind<br />Authorized<br />Education</span>
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-neutral-300 font-bold border-t border-neutral-700 pt-2 w-48 mx-auto">HyperMind AI</p>
                        <p className="text-neutral-600 text-xs uppercase tracking-wider mt-1">Instructor</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 print:hidden">
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-neutral-200 transition-colors"
                >
                    <Download size={18} /> Download / Print
                </button>
            </div>

        </div>
    );
}
