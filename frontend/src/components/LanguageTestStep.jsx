import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { onboardingService } from '../services/onboarding';
import thingualLogoAsset from '../assets/thingual_logo.png';
import '../styles/onboarding.css';

const LanguageTestStep = ({ onFinish, onBack }) => {
    const [testData, setTestData] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [results, setResults] = useState(null);
    const [finished, setFinished] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcribedText, setTranscribedText] = useState('');
    const [descriptionText, setDescriptionText] = useState('');
    const [useTextInput, setUseTextInput] = useState(false);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recognitionRef = useRef(null);
    const transcribedTextRef = useRef('');
    const questionStartTimeRef = useRef(Date.now());
    const recordingTimerRef = useRef(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);

    useEffect(() => {
        fetchTest();
    }, []);

    useEffect(() => {
        setErrorMsg('');
        // Reset the timer for each new question
        questionStartTimeRef.current = Date.now();
    }, [currentIndex]);

    const fetchTest = async () => {
        try {
            const data = await onboardingService.startTest();
            const flatQuestions = [
                ...data.grammar.map((q) => ({ ...q, type: 'grammar' })),
                ...data.sentence_correction.map((q) => ({ ...q, type: 'sentence_correction' })),
                ...data.listening.map((q) => ({ ...q, type: 'listening' })),
                ...data.vocabulary.map((q) => ({ ...q, type: 'vocabulary' })),
                ...data.picture_description.map((q) => ({ ...q, type: 'picture_description' }))
            ];
            setTestData(flatQuestions);
            setIsLoading(false);
        } catch (error) {
            console.error('Failed to load test', error);
            setErrorMsg('Failed to load questions. Please refresh.');
            setIsLoading(false);
        }
    };

    const currentQuestion = testData ? testData[currentIndex] : null;

    const handleNext = async (skipped = false) => {
        setIsSubmitting(true);
        setErrorMsg('');
        try {
            if (!skipped && (currentQuestion.type === 'grammar' || currentQuestion.type === 'sentence_correction')) {
                const elapsedSec = (Date.now() - questionStartTimeRef.current) / 1000;
                await onboardingService.submitMcqAnswer({
                    question_type: currentQuestion.type,
                    question_id: currentQuestion.id,
                    user_answer: selectedOption,
                    response_time: parseFloat(elapsedSec.toFixed(2))
                });
            }

            if (currentIndex < 9) {
                setSelectedOption('');
                setUseTextInput(false);
                setDescriptionText('');
                setCurrentIndex(currentIndex + 1);
            } else {
                const res = await onboardingService.getResults();
                setResults(res);
                setFinished(true);
            }
        } catch (error) {
            console.error('Action failed', error);
            setErrorMsg('Connection error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitTextDescription = async () => {
        setIsSubmitting(true);
        try {
            const elapsedSec = (Date.now() - questionStartTimeRef.current) / 1000;
            const formData = new FormData();
            formData.append('question_type', currentQuestion.type);
            formData.append('question_id', currentQuestion.id);
            formData.append('provided_text', descriptionText);
            formData.append('duration', elapsedSec.toFixed(2));
            await onboardingService.submitSpeech(formData);
            handleNext();
        } catch (error) {
            setErrorMsg('Failed to submit description. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            setTranscribedText('');
            transcribedTextRef.current = '';

            // Setup Browser Speech Recognition (Web Speech API)
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn("Speech Recognition not supported in this browser.");
            } else {
                const recognition = new SpeechRecognition();
                recognition.lang = 'en-US';
                recognition.interimResults = false;
                recognition.maxAlternatives = 1;

                recognition.onstart = () => console.log("Speech Recognition started");
                recognition.onerror = (e) => console.error("Speech Recognition error:", e);
                recognition.onend = () => console.log("Speech Recognition ended");

                recognition.onresult = (event) => {
                    const text = event.results[0][0].transcript;
                    console.log("Recognition result received:", text);
                    setTranscribedText(text);
                    transcribedTextRef.current = text;
                };
                
                recognition.start();
                recognitionRef.current = recognition;
            }

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                // Wait a moment for browser speech recognition to finish
                await new Promise(resolve => setTimeout(resolve, 1500));

                const spokenText = transcribedTextRef.current || '';
                console.log("Final transcribed text:", spokenText);
                const elapsedSec = (Date.now() - questionStartTimeRef.current) / 1000;

                // If no text was captured by browser, show type fallback
                if (!spokenText.trim()) {
                    setErrorMsg("Couldn't hear you clearly. Please use the 'type' option below to enter your answer.");
                    setUseTextInput(true);
                    setIsSubmitting(false);
                    return;
                }

                const formData = new FormData();
                // Always send provided_text so backend never needs Whisper/ffmpeg
                formData.append('provided_text', spokenText);
                formData.append('question_type', currentQuestion.type);
                formData.append('question_id', currentQuestion.id);
                formData.append('duration', elapsedSec.toFixed(2));
                
                setIsSubmitting(true);
                setErrorMsg('');
                try {
                    await onboardingService.submitSpeech(formData);
                    handleNext();
                } catch (error) {
                    console.error("Speech submission failed", error);
                    const detail = error.response?.data?.detail || "";
                    if (error.response?.status === 401) {
                        setErrorMsg("Session expired or invalid. Please refresh the page and log in again.");
                    } else {
                        setErrorMsg(detail || "Speech processing failed. Try typing your answer instead.");
                        setUseTextInput(true);
                    }
                    setIsSubmitting(false);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingSeconds(0);

            // Start countdown timer
            let seconds = 0;
            recordingTimerRef.current = setInterval(() => {
                seconds++;
                setRecordingSeconds(seconds);
            }, 1000);

            const timeout = currentQuestion.type === 'picture_description' ? 20000 : 8000;
            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') stopRecording();
            }, timeout);
        } catch (err) {
            console.error("Recording error:", err);
            alert("Microphone access is required for this part of the test.");
        }
    };

    const stopRecording = () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    // Click-to-toggle recording
    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const playTTS = (text, autoStartRecord = false) => {
        if (!text) return;
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // You can customize the voice/rate here
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1.0;
        
        // Get available voices and prefer a natural English one if possible
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                           voices.find(v => v.lang.startsWith('en'));
        
        if (englishVoice) utterance.voice = englishVoice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            if (autoStartRecord && window.innerWidth > 768) {
                // Short delay before starting to avoid capturing the end of TTS
                setTimeout(() => startRecording(), 500);
            }
        };
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    };

    if (isLoading) return <div className="onboarding-content text-center" style={{ marginTop: '100px' }}>Preparing your assessment...</div>;

    if (finished) {
        return (
            <div className="onboarding-content text-center" style={{ marginTop: '40px' }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="success-icon-container" style={{ fontSize: '48px', marginBottom: '20px' }}>🎯</div>
                    <h2 className="onboarding-heading">Assessment Complete!</h2>
                    <p className="onboarding-subheading">We&apos;ve determined your starting level.</p>

                    <div className="level-result-card" style={{
                        background: '#f0f7ff',
                        padding: '40px',
                        borderRadius: '24px',
                        margin: '30px auto',
                        maxWidth: '300px',
                        border: '2px solid #3b82f6',
                        boxShadow: '0 20px 40px rgba(59, 130, 246, 0.1)'
                    }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>CEFR LEVEL</div>
                        <div style={{ fontSize: '84px', fontWeight: '900', color: '#1e3a8a', lineHeight: '1' }}>{results.level}</div>
                        <div style={{ marginTop: '20px', height: '1px', background: '#dbeafe', width: '100%' }} />
                        <p style={{ marginTop: '15px', color: '#64748b', fontWeight: '600' }}>Score: {results.total_score.toFixed(1)} / 10</p>
                    </div>

                    <button className="btn-primary onboarding-next" style={{ maxWidth: '300px', margin: '0 auto' }} onClick={() => onFinish(results)}>
                        Go to Dashboard
                    </button>
                </motion.div>
            </div>
        );
    }

    if (!currentQuestion && !isLoading && !finished) {
        return <div className="onboarding-content text-center" style={{ marginTop: '100px' }}>No questions available. Please refresh or try again later.</div>;
    }

    const isSpeechQuestion = currentQuestion ? ['listening', 'vocabulary', 'picture_description'].includes(currentQuestion.type) : false;
    const canContinue = isSpeechQuestion ? false : (selectedOption && !isSubmitting);

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

                <div className="onboarding-status-pill">
                    {currentIndex + 1} / 10
                </div>
            </div>

            <div className="onboarding-content">
                {errorMsg && (
                    <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', fontSize: '14px', border: '1px solid #fee2e2' }}>
                        ⚠ {errorMsg}
                    </div>
                )}

                <div className="onboarding-test-header" style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div className="step-indicator-centered">Step 3 of 3</div>
                    <h2 className="onboarding-heading">Let&apos;s determine your baseline.</h2>
                    <p className="onboarding-subheading" style={{ marginBottom: 0 }}>Don&apos;t worry — there&apos;s no penalty for wrong answers.</p>
                </div>

                <div className="progress-bar-container" style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', marginBottom: '40px', overflow: 'hidden', width: '100%' }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentIndex + 1) * 10}%` }}
                        style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', height: '100%' }}
                    />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 0.3 }}
                        style={{ width: '100%' }}
                    >
                        <div style={{ marginBottom: '16px' }}>
                            <span style={{
                                color: '#3b82f6',
                                fontSize: '12px',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                {currentIndex < 3 ? "Complete the sentence" :
                                    currentIndex < 6 ? "Choose the correct sentence" :
                                    currentIndex < 9 ? "Listen and Repeat" :
                                        "Image Description"}
                            </span>
                        </div>
                        <h3 className="onboarding-heading" style={{ fontSize: '24px', marginBottom: '32px', textAlign: 'center', lineHeight: '1.4' }}>
                            {currentQuestion?.question || 
                             (currentQuestion?.type === 'picture_description' ? "Describe what you see in the image" : 
                              currentQuestion?.type === 'listening' ? "Play the audio and repeat the same" : "")}
                        </h3>

                        {(currentQuestion?.type === 'grammar' || currentQuestion?.type === 'sentence_correction') && (
                            <div className="goal-list">
                                {['option_a', 'option_b', 'option_c', 'option_d'].map((optKey) => (
                                    <div
                                        key={optKey}
                                        className={`goal-card ${selectedOption === currentQuestion?.[optKey] ? 'selected' : ''}`}
                                        onClick={() => setSelectedOption(currentQuestion?.[optKey])}
                                        style={{ padding: '16px 20px' }}
                                    >
                                        <div className="goal-info">
                                            <span style={{ fontSize: '15px', color: selectedOption === currentQuestion?.[optKey] ? '#2563eb' : '#4b5563', fontWeight: '500' }}>
                                                {currentQuestion?.[optKey]}
                                            </span>
                                        </div>
                                        <div className="goal-selection-ui">
                                            <div className="goal-radio-circle"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {currentQuestion?.type === 'listening' && (
                            <div className="listen-repeat-container">
                                {/* STEP 1: Listen */}
                                <div className={`lr-step-label ${isSpeaking ? 'active' : (transcribedTextRef.current ? 'done' : '')}`}>
                                    <span className="step-num">1</span>
                                    Listen to the sentence
                                </div>

                                <div 
                                    className={`lr-player-card ${isSpeaking ? 'playing' : ''}`}
                                    onClick={() => playTTS(currentQuestion?.sentence, false)}
                                >
                                    <button className={`lr-play-btn ${isSpeaking ? 'playing' : ''}`}>
                                        {isSpeaking ? (
                                            <div className="lr-soundwave">
                                                <span></span><span></span><span></span><span></span><span></span>
                                            </div>
                                        ) : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M8 5v14l11-7z"/>
                                            </svg>
                                        )}
                                    </button>
                                    <div className="lr-player-info">
                                        <div className="lr-player-title">{isSpeaking ? 'Playing...' : 'Tap to Listen'}</div>
                                        <div className="lr-player-sub">{isSpeaking ? 'Listen carefully, then repeat' : 'Hear the sentence clearly'}</div>
                                    </div>
                                </div>

                                <div className="lr-divider"></div>

                                {/* STEP 2: Speak */}
                                <div className={`lr-step-label ${isRecording ? 'active' : ''}`}>
                                    <span className="step-num">2</span>
                                    {isRecording ? 'Recording...' : 'Now repeat it'}
                                </div>

                                <div className="lr-mic-section">
                                    {!useTextInput ? (
                                        <>
                                            <div className={`lr-mic-wrapper ${isRecording ? 'recording' : ''}`}>
                                                <div className="lr-mic-ring"></div>
                                                <div className="lr-mic-ring"></div>
                                                <div className="lr-mic-ring"></div>
                                                <button
                                                    className={`lr-mic-btn ${isRecording ? 'recording' : ''}`}
                                                    onClick={toggleRecording}
                                                >
                                                    {isRecording ? (
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                                            <rect x="6" y="6" width="12" height="12" rx="2"/>
                                                        </svg>
                                                    ) : (
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3s-3 1.34-3 3v6c0 1.66 1.34 3 3 3z" />
                                                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                            {isRecording ? (
                                                <div style={{ textAlign: 'center' }}>
                                                    <p className="lr-mic-label recording" style={{ fontSize: '16px' }}>
                                                        ● {recordingSeconds}s — Tap to stop
                                                    </p>
                                                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Speak now, auto-stops in {8 - recordingSeconds}s</p>
                                                </div>
                                            ) : (
                                                <p className="lr-mic-label">Tap to start recording</p>
                                            )}
                                            {!isRecording && (
                                                <button className="lr-type-link" onClick={() => setUseTextInput(true)}>
                                                    ⌨ Type instead
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="lr-text-fallback">
                                            <input
                                                type="text"
                                                className="lr-text-input"
                                                placeholder="Type exactly what you heard..."
                                                value={descriptionText}
                                                onChange={(e) => setDescriptionText(e.target.value)}
                                                autoFocus
                                            />
                                            <div className="lr-btn-row">
                                                <button className="lr-btn-secondary" onClick={() => setUseTextInput(false)}>
                                                    🎙 Use voice
                                                </button>
                                                <button
                                                    className="lr-btn-submit"
                                                    disabled={!descriptionText.trim() || isSubmitting}
                                                    onClick={handleSubmitTextDescription}
                                                >
                                                    {isSubmitting ? 'Sending...' : 'Submit →'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(currentQuestion?.type === 'vocabulary' || currentQuestion?.type === 'picture_description') && (
                            <div className="audio-control text-center">
                                <img src={currentQuestion?.image_url} alt="Test" className="image-preview" style={{ width: '100%', borderRadius: '20px', marginBottom: '30px', maxHeight: '280px', objectFit: 'cover' }} />
                                
                                {!useTextInput ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                        <div className={`lr-mic-wrapper ${isRecording ? 'recording' : ''}`}>
                                            <div className="lr-mic-ring"></div>
                                            <div className="lr-mic-ring"></div>
                                            <div className="lr-mic-ring"></div>
                                            <button
                                                className={`lr-mic-btn ${isRecording ? 'recording' : ''}`}
                                                onClick={toggleRecording}
                                            >
                                                {isRecording ? (
                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                                                    </svg>
                                                ) : (
                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3s-3 1.34-3 3v6c0 1.66 1.34 3 3 3z" />
                                                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        {isRecording ? (
                                            <div style={{ textAlign: 'center' }}>
                                                <p className="lr-mic-label recording" style={{ fontSize: '16px' }}>
                                                    ● {recordingSeconds}s — Tap to stop
                                                </p>
                                                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Describe what you see</p>
                                            </div>
                                        ) : (
                                            <p className="lr-mic-label">Tap to start describing</p>
                                        )}
                                        {!isRecording && (
                                            <button className="lr-type-link" onClick={() => setUseTextInput(true)}>
                                                ⌨ Type your description
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="lr-text-fallback">
                                        <input
                                            type="text"
                                            className="lr-text-input"
                                            placeholder="Describe what you see in the image..."
                                            value={descriptionText}
                                            onChange={(e) => setDescriptionText(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="lr-btn-row">
                                            <button className="lr-btn-secondary" onClick={() => setUseTextInput(false)}>
                                                🎙 Use voice
                                            </button>
                                            <button
                                                className="lr-btn-submit"
                                                disabled={!descriptionText.trim() || isSubmitting}
                                                onClick={handleSubmitTextDescription}
                                            >
                                                {isSubmitting ? 'Sending...' : 'Submit →'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ height: '40px' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                            <button
                                className="onboarding-next"
                                disabled={!canContinue && !isSubmitting}
                                onClick={() => handleNext(false)}
                                style={{
                                    margin: 0,
                                    opacity: (!canContinue && !isSpeechQuestion) ? 0.4 : 1,
                                    color: '#ffffff',
                                    fontWeight: '800'
                                }}
                            >
                                {isSubmitting ? 'Processing...' : (isSpeechQuestion ? 'Tap mic to record ↑' : 'Continue')}
                            </button>

                            <button
                                onClick={() => handleNext(true)}
                                disabled={isSubmitting}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#475569',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    fontSize: '15px',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '4px'
                                }}
                            >
                                Skip / I don&apos;t know
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LanguageTestStep;
