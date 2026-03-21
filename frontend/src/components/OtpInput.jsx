"use client";
import React, { useRef, useEffect } from 'react';

/**
 * 6-box OTP input component.
 * Props:
 *   value: string (6 chars)
 *   onChange: (val: string) => void
 *   hasError: boolean
 *   disabled: boolean
 */
const OtpInput = ({ value = '', onChange, hasError = false, disabled = false }) => {
    const inputsRef = useRef([]);
    const OTP_LENGTH = 6;

    // focus first empty box on mount
    useEffect(() => {
        if (inputsRef.current[0]) inputsRef.current[0].focus();
    }, []);

    const handleChange = (e, idx) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 1);
        const chars = value.split('');
        chars[idx] = raw;
        const next = chars.join('').padEnd(OTP_LENGTH, '').slice(0, OTP_LENGTH);
        // strip trailing empty
        onChange(next.replace(/\s+$/, ''));
        if (raw && idx < OTP_LENGTH - 1) {
            inputsRef.current[idx + 1]?.focus();
        }
    };

    const handleKeyDown = (e, idx) => {
        if (e.key === 'Backspace') {
            if (!value[idx] && idx > 0) {
                inputsRef.current[idx - 1]?.focus();
                const chars = value.split('');
                chars[idx - 1] = '';
                onChange(chars.join(''));
            }
        }
        if (e.key === 'ArrowLeft' && idx > 0) inputsRef.current[idx - 1]?.focus();
        if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) inputsRef.current[idx + 1]?.focus();
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        onChange(pasted);
        const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1);
        inputsRef.current[lastIdx]?.focus();
    };

    return (
        <div className="otp-container">
            {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
                <input
                    key={idx}
                    ref={(el) => (inputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value[idx] || ''}
                    onChange={(e) => handleChange(e, idx)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className={`otp-box ${value[idx] ? 'filled' : ''} ${hasError ? 'error-box' : ''}`}
                    autoComplete="one-time-code"
                />
            ))}
        </div>
    );
};

export default OtpInput;
