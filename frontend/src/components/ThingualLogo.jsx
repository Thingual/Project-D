import React from 'react';

/**
 * ThingualLogo — inline SVG logo component.
 * variant="dark"  → dark navy text  (for white/light backgrounds)
 * variant="light" → white text      (for dark/navy backgrounds)
 */
const ThingualLogo = ({ variant = 'dark', height = 38 }) => {
    const textColor = variant === 'light' ? '#ffffff' : '#0A1628';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            {/* ── Cloud speech-bubble icon ── */}
            <svg
                height={height}
                viewBox="0 0 54 54"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
            >
                <defs>
                    <linearGradient id={`tGrad-${variant}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                </defs>

                {/*
                  Cloud blob shape — mirrors the original Thingual logo:
                  bumpy top edge (3 lobes), flat-ish bottom, speech-bubble
                  tail pointing bottom-left.
                */}
                <path
                    d="
                      M14 6
                      C14 3 17 1 21 2
                      C22 0 25 -1 29 1
                      C31 0 35 1 37 4
                      C40 3 44 6 43 10
                      C46 12 46 17 44 20
                      C43 25 39 28 34 28
                      L16 28
                      L8 36
                      L11 28
                      C6 26 4 21 5 16
                      C5 10 9 6 14 6
                      Z
                    "
                    fill={`url(#tGrad-${variant})`}
                />

                {/* White T */}
                <text
                    x="25"
                    y="22"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="16"
                    fontWeight="800"
                    fontFamily="Outfit, sans-serif"
                >
                    T
                </text>

                {/* Small speech-bubble dots */}
                <circle cx="16" cy="41" r="2.2" fill={`url(#tGrad-${variant})`} opacity="0.75" />
                <circle cx="11" cy="47" r="1.4" fill={`url(#tGrad-${variant})`} opacity="0.5" />
            </svg>

            {/* ── "Thingual" wordmark ── */}
            <span style={{
                fontSize: '20px',
                fontWeight: 700,
                color: textColor,
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.3px',
                lineHeight: 1,
            }}>
                Thingual
            </span>
        </div>
    );
};

export default ThingualLogo;
