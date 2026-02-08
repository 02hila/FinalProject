/**
 * OnboardingGuide.jsx
 *
 * An interactive guided tour overlay that highlights specific UI elements with a
 * spotlight effect and displays instructional tooltips alongside them. Designed
 * for first-time users of the agent and company dashboards. The guide walks the
 * user through a series of steps, each targeting a DOM element via a CSS selector.
 *
 * Props:
 *  - steps      (Array)    Array of step objects: { target, title, content, position, icon }.
 *  - onComplete (Function) Called when the tour is finished or the user clicks "skip".
 *  - isVisible  (boolean)  Controls whether the overlay is rendered.
 *
 * Used by: AgentDashboard and CompanyDashboard pages, paired with step definitions
 * from tourSteps.js.
 *
 * Notable behaviour:
 *  - The spotlight is rendered using an SVG mask: a full-screen white rect with a
 *    black rounded-rect cutout over the target element. The mask makes the cutout
 *    area transparent while the rest of the overlay stays semi-opaque.
 *  - If a target element is not found in the DOM, the step is automatically skipped.
 *  - Tooltip position is dynamically calculated and clamped to the viewport edges
 *    to prevent overflow.
 *  - Scroll, resize, and step-change events all trigger a position recalculation.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './OnboardingGuide.css';

/**
 * Renders the full-screen onboarding tour overlay with spotlight and tooltip.
 *
 * @param {Object}   props
 * @param {Array}    props.steps      - Ordered list of tour step definitions.
 * @param {Function} props.onComplete - Callback for tour completion or skip.
 * @param {boolean}  props.isVisible  - Whether to show the guide.
 * @returns {React.ReactElement|null}
 */
const OnboardingGuide = ({ steps, onComplete, isVisible }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [stepStartTime, setStepStartTime] = useState(Date.now());
    const tooltipRef = useRef(null);
    const skipTimeoutRef = useRef(null);

    /**
     * Locates the current step's target element in the DOM and records its
     * bounding rectangle. If the element is outside the visible viewport it
     * is scrolled into view, and the position is recalculated after the scroll
     * animation completes. If the target is not found, retries up to 3 times.
     */
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

            // Scroll element into view if it is near the edge of the viewport.
            const elementCenter = rect.top + rect.height / 2;
            const viewportCenter = window.innerHeight / 2;

            if (rect.top < 100 || rect.bottom > window.innerHeight - 100) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // Re-measure after the smooth scroll finishes.
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
            // Target not found -- retry up to 3 times with increasing delay
            if (!skipTimeoutRef.current) {
                let retryCount = 0;
                const maxRetries = 3;

                const retry = () => {
                    retryCount++;
                    const element = document.querySelector(step.target);
                    if (element || retryCount >= maxRetries) {
                        if (element) {
                            // Element found, update position
                            updateTargetPosition();
                        } else {
                            // Max retries reached, show tooltip in center
                            console.warn(`Target element not found after ${maxRetries} retries: ${step.target}. Showing tooltip in center.`);
                            setTargetRect({
                                top: window.scrollY + window.innerHeight / 2,
                                left: window.scrollX + window.innerWidth / 2,
                                width: 0,
                                height: 0,
                                viewportTop: window.innerHeight / 2,
                                viewportLeft: window.innerWidth / 2
                            });
                        }
                        skipTimeoutRef.current = null;
                    } else {
                        // Retry with increasing delay
                        skipTimeoutRef.current = setTimeout(retry, 500 * retryCount);
                    }
                };

                skipTimeoutRef.current = setTimeout(retry, 200);
            }
        }
    }, [currentStep, steps]);

    /**
     * Recalculates the spotlight position whenever the current step changes,
     * the window is resized, or the page is scrolled.
     */
    useEffect(() => {
        if (!isVisible) return;

        setIsAnimating(true);
        setStepStartTime(Date.now()); // Reset timer when guide becomes visible
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

    // --- Navigation handlers ---

    /** Advances to the next step, or completes the tour if on the last step. */
    const handleNext = () => {
        const timeSpent = Date.now() - stepStartTime;
        const minStepTime = currentStep < 3 ? 60000 : 20000; // 60 seconds for first 3 steps, 20 seconds for others

        if (timeSpent < minStepTime) {
            // Don't allow advancing too quickly
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
            setStepStartTime(Date.now());
        } else {
            handleComplete();
        }
    };

    /** Returns to the previous step. */
    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    /** Skips the remaining steps and ends the tour. */
    const handleSkip = () => {
        handleComplete();
    };

    /** Resets the step counter and notifies the parent that the tour is done. */
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

    /**
     * Calculates the absolute CSS position for the tooltip based on the target
     * element's rectangle and the step's preferred position (top/bottom/left/right).
     * Clamps the result so the tooltip stays within the viewport.
     *
     * @returns {{ top: string, left: string, arrowPosition?: string }}
     */
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

        // Clamp horizontal position to keep the tooltip within the viewport.
        if (left < padding) left = padding;
        if (left + tooltipWidth > window.innerWidth - padding) {
            left = window.innerWidth - tooltipWidth - padding;
        }
        // If the tooltip overflows the top, flip it below the target instead.
        if (top < padding) {
            top = targetRect.viewportTop + targetRect.height + padding;
            arrowPosition = 'top';
        }
        // If it overflows the bottom, flip it above the target.
        if (top + tooltipHeight > window.innerHeight - padding) {
            top = targetRect.viewportTop - tooltipHeight - padding;
            arrowPosition = 'bottom';
        }

        return { top: `${top}px`, left: `${left}px`, arrowPosition };
    };

    const tooltipStyle = getTooltipPosition();

    return (
        <div className="onboarding-guide-overlay">
            {/* SVG-based spotlight overlay with a mask cutout around the target element */}
            {targetRect && (
                <div className="onboarding-guide-spotlight">
                    <svg width="100%" height="100%" className="onboarding-guide-svg">
                        <defs>
                            {/*
                              SVG mask technique: a white rectangle covers the entire viewport
                              (fully opaque), and a black rounded rectangle punches a transparent
                              hole at the target element's position.
                            */}
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
                        {/* Semi-transparent overlay applied through the mask */}
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
                            disabled={!targetRect}
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
