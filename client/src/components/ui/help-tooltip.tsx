import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  content: React.ReactNode;
  icon?: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  iconSize?: number;
}

export function HelpTooltip({
  content,
  icon,
  side = "top",
  align = "center",
  className = "",
  iconSize = 16,
}: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger className={`inline-flex cursor-help ${className}`}>
          {icon || <HelpCircle size={iconSize} className="text-muted-foreground hover:text-primary transition-colors" />}
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-xs p-4 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="flex flex-col space-y-2">
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface IllustratedTooltipProps extends HelpTooltipProps {
  illustration: string;
  altText?: string;
  title?: string;
}

export function IllustratedTooltip({
  content,
  illustration,
  altText = "Helpful illustration",
  title,
  ...props
}: IllustratedTooltipProps) {
  return (
    <HelpTooltip
      content={
        <>
          {title && <h4 className="font-medium text-primary mb-1">{title}</h4>}
          <div className="rounded-md overflow-hidden mb-2 max-w-[200px] mx-auto">
            <img 
              src={illustration} 
              alt={altText}
              className="w-full h-auto object-contain"
            />
          </div>
          <div className="text-sm text-gray-700">{content}</div>
        </>
      }
      {...props}
    />
  );
}