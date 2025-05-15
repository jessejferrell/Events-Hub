import React from 'react';
import { useHelp, HELP_TOPICS } from '@/contexts/help-context';
import { IllustratedTooltip } from '@/components/ui/help-tooltip';
import { HelpCircle } from 'lucide-react';

type HelpTopicKey = keyof typeof HELP_TOPICS;
type HelpTopicValue = typeof HELP_TOPICS[HelpTopicKey];

interface ContextualHelpProps {
  topic?: HelpTopicValue;
  title?: string;
  content?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  iconSize?: number;
  variant?: "default" | "compact";
  placement?: string; // For compatibility with older code
}

export function ContextualHelp({ 
  topic, 
  title,
  content,
  side = "top", 
  align = "center", 
  className = "",
  iconSize = 16,
  variant = "default",
  placement // For compatibility
}: ContextualHelpProps) {
  const { isHelpEnabled, getHelpItem, showTooltips } = useHelp();
  
  // For backward compatibility, convert placement to side
  const finalSide = placement || side;
  
  // If help is disabled, don't render anything
  if (!isHelpEnabled || !showTooltips) {
    return null;
  }
  
  let tooltipTitle = title;
  let tooltipContent = content;
  let illustration: string | undefined = undefined;
  
  // If a topic is provided, it takes precedence over direct props
  if (topic) {
    const helpItem = getHelpItem(topic);
    if (!helpItem) {
      return null;
    }
    tooltipTitle = helpItem.title;
    tooltipContent = helpItem.content;
    illustration = helpItem.illustration;
  }
  
  // We must have either topic or direct content
  if (!tooltipTitle || !tooltipContent) {
    return null;
  }
  
  return (
    <IllustratedTooltip
      title={tooltipTitle || ""}
      content={tooltipContent || ""}
      illustration={illustration}
      side={finalSide as "top" | "right" | "bottom" | "left"}
      align={align}
      className={className}
      iconSize={iconSize}
      icon={<HelpCircle size={variant === "compact" ? (iconSize - 4) : iconSize} 
        className={`text-primary hover:text-primary/80 transition-colors ${variant === "compact" ? "absolute -top-2 -right-2" : ""}`} />}
    />
  );
}

export function HelpToggleButton() {
  const { isHelpEnabled, toggleHelp } = useHelp();
  
  return (
    <button
      onClick={toggleHelp}
      className="flex items-center gap-2 text-sm font-medium rounded-md px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
    >
      <HelpCircle size={16} />
      {isHelpEnabled ? 'Disable Help' : 'Enable Help'}
    </button>
  );
}