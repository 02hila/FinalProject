import React, { useState, useEffect, useCallback, useRef } from 'react';
import './OnboardingGuide.css';

/**
 * OnboardingGuide Component
 *
 * An interactive guided tour that highlights UI elements with a spotlight effect
 * and displays helpful tooltips for first-time users.
 *
 * @param {Array} steps - Array of step objects with target, title, content, and position
 * @param {Function} onComplete - Callback when the tour is completed or skipped
 * @param {boolean} isVisible - Whether the guide should be shown
 */
const OnboardingGuide = ({ steps, onComplete, isVisible }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const tooltipRef = useRef(null);

    // Find and highlight the target element
    const updateTargetPosition = useCallback(() => {
        if (!steps || steps.length === 0 || currentStep >= steps.length) return;

        const step = steps[currentStep];
        const targetElement = document.querySelector(step.target);

        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            setTargetRect({
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height,
                viewportTop: rect.top,
                viewportLeft: rect.left
            });

            // Scroll element into view if needed
            const elementCenter = rect.top + rect.height / 2;
            const viewportCenter = window.innerHeight / 2;

            if (rect.top < 100 || rect.bottom > window.innerHeight - 100) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // Update position after scroll
                setTimeout(() => {
                    const newRect = targetElement.getBoundingClientRect();
                    setTargetRect({
                        top: newRect.top + window.scrollY,
                        left: newRect.left + window.scrollX,
                        width: newRect.width,
                        height: newRect.height,
                        viewportTop: newRect.top,
                        viewportLeft: newRect.left
                    });
                }, 400);
            }
        } else {
            // Target not found, try next step
            console.warn(`Target element not found: ${step.target}`);
            if (currentStep < steps.length - 1) {
                setTimeout(() => setCurrentStep(prev => prev + 1), 100);
            }
        }
    }, [currentStep, steps]);

    // Update position on step change or window resize
    useEffect(() => {
        if (!isVisible) return;

        setIsAnimating(true);
        updateTargetPosition();

        const animationTimeout = setTimeout(() => setIsAnimating(false), 300);

        const handleResize = () => updateTargetPosition();
        const handleScroll = () => updateTargetPosition();

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            clearTimeout(animationTimeout);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isVisible, currentStep, updateTargetPosition]);

    // Navigation handlers
    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = () => {
        setCurrentStep(0);
        if (onComplete) {
            onComplete();
        }
    };

    // Don't render if not visible or no steps
    if (!isVisible || !steps || steps.length === 0) {
        return null;
    }

    const step = steps[currentStep];
    if (!step) return null;

    // Calculate tooltip position
    const getTooltipPosition = () => {
        if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

        const position = step.position || 'bottom';
        const padding = 20;
        const tooltipWidth = 340;
        const tooltipHeight = 220;

        let top, left, arrowPosition;

        switch (position) {
            case 'top':
                top = targetRect.viewportTop - tooltipHeight - padding;
                left = targetRect.viewportLeft + (targetRect.width / 2) - (tooltipWidth / 2);
                arrowPosition = 'bottom';
                break;
            case 'bottom':
                top = targetRect.viewportTop + targetRect.height + padding;
                left = targetRect.viewportLeft + (targetRect.width / 2) - (tooltipWidth / 2);
                arrowPosition = 'top';
                break;
            case 'left':
                top = targetRect.viewportTop + (targetRect.height / 2) - (tooltipHeight / 2);
                left = targetRect.viewportLeft - tooltipWidth - padding;
                arrowPosition = 'right';
                break;
            case 'right':
                top = targetRect.viewportTop + (targetRect.height / 2) - (tooltipHeight / 2);
                left = targetRect.viewportLeft + targetRect.width + padding;
                arrowPosition = 'left';
                break;
            default:
                top = targetRect.viewportTop + targetRect.height + padding;
                left = targetRect.viewportLeft + (targetRect.width / 2) - (tooltipWidth / 2);
                arrowPosition = 'top';
        }

        // Keep tooltip in viewport
        if (left < padding) left = padding;
        if (left + tooltipWidth > window.innerWidth - padding) {
            left = window.innerWidth - tooltipWidth - padding;
        }
        if (top < padding) {
            top = targetRect.viewportTop + targetRect.height + padding;
            arrowPosition = 'top';
        }
        if (top + tooltipHeight > window.innerHeight - padding) {
            top = targetRect.viewportTop - tooltipHeight - padding;
            arrowPosition = 'bottom';
        }

        return { top: `${top}px`, left: `${left}px`, arrowPosition };
    };

    const tooltipStyle = getTooltipPosition();

    return (
        <div className="onboarding-guide-overlay">
            {/* Spotlight overlay with cutout */}
            {targetRect && (
                <div className="onboarding-guide-spotlight">
                    <svg width="100%" height="100%" className="onboarding-guide-svg">
                        <defs>
                            <mask id="spotlight-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                <rect
                                    x={targetRect.viewportLeft - 8}
                                    y={targetRect.viewportTop - 8}
                                    width={targetRect.width + 16}
                                    height={targetRect.height + 16}
                                    rx="12"
                                    ry="12"
                                    fill="black"
                                />
                            </mask>
                        </defs>
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="rgba(0, 0, 0, 0.6)"
                            mask="url(#spotlight-mask)"
                        />
                    </svg>

                    {/* Highlight border around target */}
                    <div
                        className="onboarding-guide-highlight"
                        style={{
                            top: targetRect.viewportTop - 8,
                            left: targetRect.viewportLeft - 8,
                            width: targetRect.width + 16,
                            height: targetRect.height + 16
                        }}
                    />
                </div>
            )}

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className={`onboarding-guide-tooltip ${isAnimating ? 'animating' : ''}`}
                style={{ top: tooltipStyle.top, left: tooltipStyle.left }}
            >
                {/* Arrow */}
                <div className={`onboarding-guide-arrow ${tooltipStyle.arrowPosition || 'top'}`} />

                {/* Header */}
                <div className="onboarding-guide-header">
                    <span className="onboarding-guide-step-icon">{step.icon || '📍'}</span>
                    <h3 className="onboarding-guide-title">{step.title}</h3>
                </div>

                {/* Content */}
                <div className="onboarding-guide-content">
                    <p>{step.content}</p>
                </div>

                {/* Progress dots */}
                <div className="onboarding-guide-progress">
                    {steps.map((_, index) => (
                        <span
                            key={index}
                            className={`onboarding-guide-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                        />
                    ))}
                </div>

                {/* Actions */}
                <div className="onboarding-guide-actions">
                    <button
                        className="onboarding-guide-btn skip"
                        onClick={handleSkip}
                    >
                        דלג
                    </button>

                    <div className="onboarding-guide-nav">
                        {currentStep > 0 && (
                            <button
                                className="onboarding-guide-btn prev"
                                onClick={handlePrevious}
                            >
                                הקודם
                            </button>
                        )}
                        <button
                            className="onboarding-guide-btn next"
                            onClick={handleNext}
                        >
                            {currentStep === steps.length - 1 ? 'סיום' : 'הבא'}
                        </button>
                    </div>
                </div>

                {/* Step counter */}
                <div className="onboarding-guide-counter">
                    {currentStep + 1} / {steps.length}
                </div>
            </div>
        </div>
    );
};

export default OnboardingGuide;
