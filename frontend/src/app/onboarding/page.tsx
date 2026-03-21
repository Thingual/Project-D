'use client';

import React, { useState, useEffect, useRef } from 'react';
import { onboardingService } from '@/services/onboarding';
import '@/styles/onboarding.css';
import { motion, AnimatePresence } from 'framer-motion';

export default function OnboardingPage() {
  const [testData, setTestData]: any = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [results, setResults]: any = useState(null);
  const [finished, setFinished] = useState(false);
  const [descriptionText, setDescriptionText] = useState('');
  const [useTextInput, setUseTextInput] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchTest();
  }, []);

  const fetchTest = async () => {
    try {
      const data = await onboardingService.startTest();
      // Combine all sections into a flat list of 10 questions
      const flatQuestions = [
        ...data.grammar.map((q: any) => ({ ...q, type: 'grammar' })),
        ...data.sentence_correction.map((q: any) => ({ ...q, type: 'sentence_correction' })),
        ...data.listening.map((q: any) => ({ ...q, type: 'listening' })),
        ...data.vocabulary.map((q: any) => ({ ...q, type: 'vocabulary' })),
        ...data.picture_description.map((q: any) => ({ ...q, type: 'picture_description' }))
      ];
      setTestData(flatQuestions);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load test', error);
      setIsLoading(false);
    }
  };

  const currentQuestion = testData ? testData[currentIndex] : null;

  const handleNext = async () => {
    if (currentIndex < 9) {
      if (currentQuestion.type === 'grammar' || currentQuestion.type === 'sentence_correction') {
        await onboardingService.submitMcqAnswer({
          question_type: currentQuestion.type,
          question_id: currentQuestion.id,
          user_answer: selectedOption
        });
      } else if (currentQuestion.type === 'picture_description' && useTextInput) {
        const formData = new FormData();
        formData.append('question_type', currentQuestion.type);
        formData.append('question_id', currentQuestion.id);
        formData.append('provided_text', descriptionText);
        formData.append('duration', '0.0');
        await onboardingService.submitSpeech(formData);
      }
      setSelectedOption('');
      setUseTextInput(false);
      setDescriptionText('');
      setCurrentIndex(currentIndex + 1);
    } else {
      // Final submission logic handled in speech/mcq calls
      // Now fetch final results
      const res = await onboardingService.getResults();
      setResults(res);
      setFinished(true);
    }
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.webm');
      formData.append('question_type', currentQuestion.type);
      formData.append('question_id', currentQuestion.id);
      formData.append('duration', '10.0'); // Mock duration

      await onboardingService.submitSpeech(formData);
      handleNext();
    };

    mediaRecorder.start();
    setIsRecording(true);
    
    // Auto stop after 5s for vocabulary, 15s for picture
    const timeout = currentQuestion.type === 'picture_description' ? 15000 : 5000;
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') stopRecording();
    }, timeout);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (isLoading) return <div className="onboarding-container">Loading your personalized test...</div>;

  if (finished) {
    return (
      <div className="onboarding-container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="onboarding-card text-center"
        >
          <h2 className="text-3xl font-bold mb-4">Assessment Complete!</h2>
          <div className="my-8">
            <div className="text-6xl font-black text-blue-600 mb-2">{results.level}</div>
            <div className="text-xl text-gray-600">Your English Level</div>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl">
              <span>Grammar Score</span>
              <span className="font-bold">{results.grammar_score.toFixed(1)}/3</span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
              <span>Speaking/Picture Score</span>
              <span className="font-bold">{results.picture_description_score.toFixed(1)}/1</span>
            </div>
          </div>
          <button className="next-btn" onClick={() => window.location.href = '/dashboard'}>
            Go to My Path
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
      {/* progress bar */}
      <div className="w-full max-w-lg bg-gray-200 h-2 rounded-full overflow-hidden mb-8">
        <motion.div 
          className="bg-blue-600 h-full" 
          initial={{ width: 0 }}
          animate={{ width: `${(currentIndex + 1) * 10}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="onboarding-card"
        >
          <div className="step-indicator">Step {currentIndex + 1} of 10</div>
          
          <h3 className="question-text">
            {currentQuestion.question || "Look at the image and describe it"}
            {currentQuestion.type === 'listening' && "Listen and repeat the sentence below"}
          </h3>

          {(currentQuestion.type === 'grammar' || currentQuestion.type === 'sentence_correction') && (
            <div className="options-grid">
              {['option_a', 'option_b', 'option_c', 'option_d'].map((optKey) => (
                <button
                  key={optKey}
                  className={`option-button ${selectedOption === currentQuestion[optKey] ? 'selected' : ''}`}
                  onClick={() => setSelectedOption(currentQuestion[optKey])}
                >
                  {currentQuestion[optKey]}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'listening' && (
            <div className="audio-control">
              <audio controls src={currentQuestion.audio_url} className="w-full mb-4" />
              <button 
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              >
                {isRecording ? '●' : '🎤'}
              </button>
              <p className="text-sm text-gray-500">Hold to record your voice</p>
            </div>
          )}

          {currentQuestion.type === 'vocabulary' && (
            <div className="audio-control text-center">
              <img src={currentQuestion.image_url} alt="Object" className="image-preview" />
              <p className="mb-4 font-semibold">What is this object?</p>
              <button 
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              >
                {isRecording ? '●' : '🎤'}
              </button>
            </div>
          )}

          {currentQuestion.type === 'picture_description' && (
            <div className="audio-control text-center w-full">
              <img src={currentQuestion.image_url} alt="Scene" className="image-preview" />
              <p className="mb-4">Describe this scene in detail.</p>
              
              {!useTextInput ? (
                <>
                  <button 
                    className={`record-btn ${isRecording ? 'recording' : ''}`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                  >
                    {isRecording ? '●' : '🎤'}
                  </button>
                  <p className="text-sm text-gray-500 mt-2">Hold to record your voice</p>
                  <button 
                    className="mt-4 text-blue-600 font-medium" 
                    onClick={() => setUseTextInput(true)}
                  >
                    Or type your description
                  </button>
                </>
              ) : (
                <div className="w-full">
                  <textarea
                    className="w-full p-4 border rounded-xl min-h-[120px] mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="In this picture..."
                    value={descriptionText}
                    onChange={(e) => setDescriptionText(e.target.value)}
                  />
                  <div className="flex gap-4">
                    <button 
                      className="flex-1 p-3 bg-gray-100 rounded-xl"
                      onClick={() => setUseTextInput(false)}
                    >
                      Use Voice instead
                    </button>
                    <button 
                      className="flex-1 next-btn !mt-0"
                      disabled={!descriptionText.trim()}
                      onClick={handleNext}
                    >
                      Submit Text
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          {(currentQuestion.type === 'grammar' || currentQuestion.type === 'sentence_correction') && (
            <button 
              className="next-btn" 
              disabled={!selectedOption}
              onClick={handleNext}
            >
              Continue
            </button>
          )}

          <div className="mt-8 text-center text-blue-500 font-medium cursor-pointer">
            I don't know
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
