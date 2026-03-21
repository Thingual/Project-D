"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GoogleButton from '../components/GoogleButton';
import OtpInput from '../components/OtpInput';
import ThingualLogo from '../components/ThingualLogo';
import LanguageTestStep from '../components/LanguageTestStep';
import heroIllustration from '../assets/hero_illustration.png';
import thingualLogoAsset from '../assets/thingual_logo.png';
import '../styles/auth.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const RESEND_COUNTDOWN = 60;

const stepVariants = {
    enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } },
    exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.2 } }),
};

// ════════════════════════════════════
// LEFT PANEL — STEP 1: Email
// ════════════════════════════════════
const EmailStep = ({ onContinue, onGoogleSuccess }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [googleErr, setGoogleErr] = useState('');

    const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    const handleEmailCheck = async (e) => {
        e.preventDefault();
        setError('');
        if (!isValidEmail(email)) {
            setError('Please enter a valid email address.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/check-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            onContinue(email, data.exists);
        } catch (err) {
            setError('Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <React.Fragment>
            <div className="auth-logo">
                <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="auth-logo-img" />
            </div>

            <h1 className="auth-heading">Welcome to the Club.</h1>
            <p className="auth-subheading">
                Experience the next generation of language learning.
            </p>

            {googleErr && <div className="alert-banner error">⚠ {googleErr}</div>}

            <GoogleButton onSuccess={onGoogleSuccess} onError={setGoogleErr} disabled={loading} />

            <div className="auth-divider">or continue with email</div>

            <form onSubmit={handleEmailCheck} noValidate>
                <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                        type="email"
                        className={`form-input ${error ? 'error' : ''}`}
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        disabled={loading}
                    />
                    {error && <p className="form-error">{error}</p>}
                </div>
                <button className="btn-primary" type="submit" disabled={loading || !email}>
                    {loading ? <span className="btn-spinner" /> : 'Continue'}
                </button>
            </form>
        </React.Fragment>
    );
};

// ════════════════════════════════════
// LEFT PANEL — STEP 2: Signup (Name, Pass)
// ════════════════════════════════════
const SignupStep = ({ email, onSignupSuccess, onBack }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignup = async (e) => {
        e.preventDefault();

        // Strong password regex
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!name) {
            setError('Full name is required.');
            return;
        }

        if (!passwordRegex.test(password)) {
            setError('Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Signup failed');
            onSignupSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <React.Fragment>
            <div className="auth-logo">
                <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="auth-logo-img" />
            </div>
            <button className="back-btn" onClick={onBack}>← Back</button>
            <h1 className="auth-heading">Create your profile.</h1>
            <p className="auth-subheading">Join {email} and start learning.</p>
            {error && <div className="alert-banner error">⚠ {error}</div>}
            <form onSubmit={handleSignup}>
                <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" placeholder="Enter your name" value={name} onChange={e => { setName(e.target.value); setError(''); }} />
                </div>
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="password-input-wrapper">
                        <input 
                            className="form-input" 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Min. 8 characters" 
                            value={password} 
                            onChange={e => { setPassword(e.target.value); setError(''); }} 
                        />
                        <button 
                            type="button" 
                            className="password-toggle-icon" 
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex="-1"
                        >
                            {showPassword ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            )}
                        </button>
                    </div>
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? <span className="btn-spinner" /> : 'Create Account'}
                </button>
            </form>
        </React.Fragment>
    );
};

// ════════════════════════════════════
// LEFT PANEL — STEP 3: Choice (Pass/OTP)
// ════════════════════════════════════
const LoginChoiceStep = ({ email, onPasswordChoice, onOtpChoice, onBack }) => (
    <React.Fragment>
        <div className="auth-logo">
            <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="auth-logo-img" />
        </div>
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 className="auth-heading">Welcome back.</h1>
        <p className="auth-subheading">Login to <strong>{email}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <button className="btn-primary" onClick={onPasswordChoice}>Login with Password</button>
            <div className="auth-divider">or</div>
            <button className="google-btn" style={{ marginBottom: 0 }} onClick={onOtpChoice}>Get Login OTP</button>
        </div>
    </React.Fragment>
);

// ════════════════════════════════════
// LEFT PANEL — Login with Password
// ════════════════════════════════════
const PasswordStep = ({ email, onVerified, onBack }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/login-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Login failed');
            onVerified(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <React.Fragment>
            <div className="auth-logo">
                <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="auth-logo-img" />
            </div>
            <button className="back-btn" onClick={onBack}>← Back</button>
            <h1 className="auth-heading">Enter password.</h1>
            <p className="auth-subheading">Welcome back to Thingual.</p>
            {error && <div className="alert-banner error">⚠ {error}</div>}
            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="password-input-wrapper">
                        <input 
                            className="form-input" 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Enter your password" 
                            value={password} 
                            onChange={e => { setPassword(e.target.value); setError(''); }} 
                        />
                        <button 
                            type="button" 
                            className="password-toggle-icon" 
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex="-1"
                        >
                            {showPassword ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            )}
                        </button>
                    </div>
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? <span className="btn-spinner" /> : 'Login'}
                </button>
            </form>
        </React.Fragment>
    );
};

// ════════════════════════════════════
// LEFT PANEL — STEP 4: OTP Verification
// ════════════════════════════════════
const OtpStep = ({ email, onVerified, onBack }) => {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);

    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        if (otp.length < 6) { setError('Please enter all 6 digits.'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Invalid OTP');
            onVerified(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setError('');
        try {
            await fetch(`${API_URL}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            setSuccess('A new code has been sent!');
            setCountdown(RESEND_COUNTDOWN);
            setOtp('');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to resend code');
        } finally {
            setResending(false);
        }
    };

    return (
        <React.Fragment>
            <div className="auth-logo">
                <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="auth-logo-img" />
            </div>
            <button className="back-btn" onClick={onBack}>← Back</button>
            <h1 className="auth-heading">Check your inbox.</h1>
            <p className="auth-subheading">We sent a verification code to <strong>{email}</strong>.</p>
            {success && <div className="alert-banner success">✓ {success}</div>}
            {error && <div className="alert-banner error">⚠ {error}</div>}
            <form onSubmit={handleVerify}>
                <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(''); }} hasError={!!error} disabled={loading} />
                <button className="btn-primary" type="submit" disabled={loading || otp.length < 6}>
                    {loading ? <span className="btn-spinner" /> : 'Verify Code'}
                </button>
            </form>
            <div className="resend-row">
                {countdown > 0 ? <>Resend in <strong>{countdown}s</strong></> : <button className="resend-btn" onClick={handleResend} disabled={resending}>{resending ? 'Resending…' : 'Resend Code'}</button>}
            </div>
        </React.Fragment>
    );
};

// ════════════════════════════════════
// SUCCESS STATE -> START ONBOARDING
// ════════════════════════════════════
const SuccessState = ({ user, onStart, onBack }) => (
    <div className="onboarding-view">
        <div className="onboarding-top-nav">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="onboarding-back-btn" onClick={onBack} title="Logout">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
                <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="onboarding-logo-img" />
            </div>
            <div className="onboarding-status-pill">Ready</div>
        </div>
        <div className="onboarding-content">
            <div className="success-icon-container">
                <span className="success-emoji">🎉</span>
            </div>
            <h2 className="onboarding-heading" style={{ marginBottom: '12px' }}>Welcome, {user?.name || 'Explorer'}!</h2>
            <p className="onboarding-subheading">
                You&apos;re all set. Your personalized language journey starts now.
            </p>
            <button className="btn-primary onboarding-next" onClick={onStart}>Get started</button>
        </div>
    </div>
);

// ════════════════════════════════════
// ONBOARDING — STEP 1: Goal
// ════════════════════════════════════
const GoalSelectionStep = ({ onNext, onBack }) => {
    const [selectedGoal, setSelectedGoal] = useState('serious');
    const goals = [
        { id: 'casual', title: 'Casual', time: '10min/day', desc: 'Relaxed, comfortable pace', icon: '🕒' },
        { id: 'serious', title: 'Serious', time: '20min/day', desc: 'Building fluency daily', icon: '📎' },
        { id: 'intensive', title: 'Intensive', time: '30min/day', desc: 'Rapid language mastery', icon: '⚡' },
    ];
    return (
        <div className="onboarding-view">
            <div className="onboarding-top-nav">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="onboarding-back-btn" onClick={onBack} title="Logout">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>
                    <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="onboarding-logo-img" />
                </div>
            </div>
            <div className="onboarding-content">
                <div className="step-indicator-centered">Step 1 of 3</div>
                <h2 className="onboarding-heading">How fast do you want to learn?</h2>
                <div className="goal-list">
                    {goals.map(g => (
                        <div key={g.id} className={`goal-card ${selectedGoal === g.id ? 'selected' : ''}`} onClick={() => setSelectedGoal(g.id)}>
                            <div className="goal-icon-wrapper" style={{ fontSize: '20px' }}>{g.icon}</div>
                            <div className="goal-info">
                                <div className="goal-header"><span className="goal-title">{g.title}</span> <span className="goal-time">{g.time}</span></div>
                                <p className="goal-desc">{g.desc}</p>
                            </div>
                            <div className="goal-selection-ui"><div className="goal-radio-circle"></div></div>
                        </div>
                    ))}
                </div>
                <button className="btn-primary onboarding-next" onClick={() => onNext(selectedGoal)}>Continue</button>
            </div>
        </div>
    );
};

// ════════════════════════════════════
// ONBOARDING — STEP 2: Interests
// ════════════════════════════════════
const InterestSelectionStep = ({ onFinish, onBack }) => {
    const [selected, setSelected] = useState(['Arts', 'Traveling']);
    const interests = ['Arts', 'Science', 'Coding', 'Health', 'Traveling', 'Cinema', 'Music'];
    return (
        <div className="onboarding-view">
            <div className="onboarding-top-nav">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="onboarding-back-btn" onClick={onBack} title="Back">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>
                    <img src={thingualLogoAsset.src || thingualLogoAsset} alt="Thingual" className="onboarding-logo-img" />
                </div>
            </div>
            <div className="onboarding-content">
                <div className="step-indicator-centered">Step 2 of 3</div>
                <h2 className="onboarding-heading-main">Tailor your curriculum.</h2>
                <p className="onboarding-subtext">Select your interests</p>
                
                <div className="interests-grid-optimized">
                    {interests.map(i => (
                        <button 
                            key={i} 
                            className={`interest-tag-v2 ${selected.includes(i) ? 'selected' : ''}`} 
                            onClick={() => setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                        >
                            {i}
                        </button>
                    ))}
                </div>
                <button className="btn-primary onboarding-next" style={{ marginTop: 'auto' }} onClick={() => onFinish(selected)}>Build My Plan</button>
            </div>
        </div>
    );
};

// ════════════════════════════════════
// RIGHT PANEL — Hero
// ════════════════════════════════════
const HeroPanel = () => (
    <div className="auth-right">
        <div className="hero-logo"><ThingualLogo variant="light" height={48} /></div>
        <p className="hero-tagline"><span>&quot;Learn Languages.</span> Speak Confidently.&quot;</p>
        <p className="hero-sub">Practice daily. Improve faster. Achieve fluency.</p>
        <img src={heroIllustration.src || heroIllustration} alt="Hero" className="hero-illustration" />
    </div>
);

// ════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════
const AuthPage = () => {
    // step: 'email' | 'signup' | 'login_choice' | 'password' | 'otp' | 'success' | 'onboarding_...'
    const [step, setStep] = useState('email');
    const [direction, setDirection] = useState(1);
    const [userEmail, setUserEmail] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);
    const [authedUser, setAuthedUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('thingual_user');
        const storedToken = localStorage.getItem('thingual_token');
        if (storedUser && storedToken) {
            setAuthedUser(JSON.parse(storedUser));
            setStep('success');
        }
    }, []);

    const handleEmailContinue = (email, exists) => {
        setUserEmail(email);
        setIsNewUser(!exists);
        setDirection(1);
        setStep(exists ? 'login_choice' : 'signup');
    };

    const handleSignupSuccess = () => {
        setDirection(1);
        setStep('otp');
    };

    const handleOtpChoice = async () => {
        try {
            await fetch(`${API_URL}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail }),
            });
            setDirection(1);
            setStep('otp');
        } catch (err) { alert('Failed to send OTP'); }
    };

    const onVerified = (data) => {
        if (data.token) localStorage.setItem('thingual_token', data.token);
        localStorage.setItem('thingual_user', JSON.stringify(data));
        setAuthedUser(data);
        setDirection(1);
        setStep('success');
    };

    const onGoogleSuccess = (data) => {
        if (data.token) localStorage.setItem('thingual_token', data.token);
        localStorage.setItem('thingual_user', JSON.stringify(data));
        setAuthedUser(data);
        setUserEmail(data.email || '');
        setDirection(1);
        setStep('success');
    };

    const isOnboarding = step === 'success' || step.startsWith('onboarding_');

    return (
        <div className={`auth-page ${isOnboarding ? 'onboarding-mode' : ''}`}>
            <div className={`auth-left ${isOnboarding ? 'onboarding-layout' : ''}`}>
                <div className={`${isOnboarding ? 'onboarding-form-card' : 'auth-form-card'}`}>
                    <AnimatePresence custom={direction} mode="wait">
                        {step === 'email' && (
                            <motion.div key="email" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <EmailStep onContinue={handleEmailContinue} onGoogleSuccess={onGoogleSuccess} />
                            </motion.div>
                        )}
                        {step === 'signup' && (
                            <motion.div key="signup" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <SignupStep email={userEmail} onSignupSuccess={handleSignupSuccess} onBack={() => { setDirection(-1); setStep('email'); }} />
                            </motion.div>
                        )}
                        {step === 'login_choice' && (
                            <motion.div key="login_choice" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <LoginChoiceStep email={userEmail} onPasswordChoice={() => { setDirection(1); setStep('password'); }} onOtpChoice={handleOtpChoice} onBack={() => { setDirection(-1); setStep('email'); }} />
                            </motion.div>
                        )}
                        {step === 'password' && (
                            <motion.div key="password" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <PasswordStep email={userEmail} onVerified={onVerified} onBack={() => { setDirection(-1); setStep('login_choice'); }} />
                            </motion.div>
                        )}
                        {step === 'otp' && (
                            <motion.div key="otp" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <OtpStep email={userEmail} onVerified={onVerified} onBack={() => { setDirection(-1); setStep(isNewUser ? 'signup' : 'login_choice'); }} />
                            </motion.div>
                        )}
                        {step === 'success' && (
                            <motion.div key="success" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <SuccessState user={authedUser} onStart={() => { setDirection(1); setStep('onboarding_goal'); }} onBack={() => { setDirection(-1); setStep('email'); }} />
                            </motion.div>
                        )}
                        {step === 'onboarding_goal' && (
                            <motion.div key="onboarding_goal" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <GoalSelectionStep onNext={() => { setDirection(1); setStep('onboarding_interests'); }} onBack={() => { setDirection(-1); setStep('success'); }} />
                            </motion.div>
                        )}
                        {step === 'onboarding_interests' && (
                            <motion.div key="onboarding_interests" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <InterestSelectionStep onFinish={() => { setDirection(1); setStep('onboarding_test'); }} onBack={() => { setDirection(-1); setStep('onboarding_goal'); }} />
                            </motion.div>
                        )}
                        {step === 'onboarding_test' && (
                            <motion.div key="onboarding_test" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                                <LanguageTestStep onFinish={() => window.location.href = '/dashboard'} onBack={() => { setDirection(-1); setStep('onboarding_interests'); }} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            {!isOnboarding && <HeroPanel />}
        </div>
    );
};

export default AuthPage;
