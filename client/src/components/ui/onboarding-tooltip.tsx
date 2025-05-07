import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardFooter } from "./card";
import { cn } from "@/lib/utils";

export type TooltipPosition = "top" | "right" | "bottom" | "left" | "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface OnboardingTooltipProps {
  children: React.ReactNode;
  title?: string;
  content: React.ReactNode;
  position?: TooltipPosition;
  open?: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  id: string;
  currentStep?: number;
  totalSteps?: number;
  className?: string;
}

export function OnboardingTooltip({
  children,
  title,
  content,
  position = "bottom",
  open = false,
  onClose,
  onNext,
  onPrevious,
  id,
  currentStep,
  totalSteps,
  className,
}: OnboardingTooltipProps) {
  const [isOpen, setIsOpen] = useState(open);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [tooltipStyles, setTooltipStyles] = useState<React.CSSProperties>({});

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  useEffect(() => {
    if (isOpen && targetRef.current && tooltipRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;
      
      // Position the tooltip based on the specified position
      switch (position) {
        case "top":
          top = targetRect.top - tooltipRect.height - 10;
          left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
          break;
        case "right":
          top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
          left = targetRect.right + 10;
          break;
        case "bottom":
          top = targetRect.bottom + 10;
          left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
          break;
        case "left":
          top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
          left = targetRect.left - tooltipRect.width - 10;
          break;
        case "top-right":
          top = targetRect.top - tooltipRect.height - 10;
          left = targetRect.right - tooltipRect.width;
          break;
        case "top-left":
          top = targetRect.top - tooltipRect.height - 10;
          left = targetRect.left;
          break;
        case "bottom-right":
          top = targetRect.bottom + 10;
          left = targetRect.right - tooltipRect.width;
          break;
        case "bottom-left":
          top = targetRect.bottom + 10;
          left = targetRect.left;
          break;
      }
      
      // Make sure the tooltip doesn't go off-screen
      const padding = 10;
      top = Math.max(padding, Math.min(window.innerHeight - tooltipRect.height - padding, top));
      left = Math.max(padding, Math.min(window.innerWidth - tooltipRect.width - padding, left));
      
      setTooltipStyles({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 50
      });
    }
  }, [isOpen, position]);

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="relative" ref={targetRef} data-tooltip-id={id}>
      {children}
      
      {isOpen && (
        <div 
          ref={tooltipRef}
          className={cn("absolute", className)}
          style={tooltipStyles}
          role="tooltip"
          aria-describedby={`tooltip-content-${id}`}
        >
          <Card className="w-80 shadow-lg">
            {title && (
              <div className="flex items-center justify-between border-b px-4 py-2">
                <h3 className="font-semibold">{title}</h3>
                <Button variant="ghost" size="icon" onClick={handleClose} className="h-6 w-6 rounded-full">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            )}
            <CardContent className="p-4">
              <div id={`tooltip-content-${id}`}>{content}</div>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-2">
              <div className="flex items-center text-sm text-muted-foreground">
                {currentStep && totalSteps && (
                  <span>{currentStep} of {totalSteps}</span>
                )}
              </div>
              <div className="flex space-x-2">
                {onPrevious && (
                  <Button variant="outline" size="sm" onClick={onPrevious}>
                    Previous
                  </Button>
                )}
                {onNext && (
                  <Button size="sm" onClick={onNext}>
                    Next
                  </Button>
                )}
                {!onNext && (
                  <Button size="sm" onClick={handleClose}>
                    Got it
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}