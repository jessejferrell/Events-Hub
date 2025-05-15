import React from 'react';
import { useHelp, HELP_TOPICS } from '@/contexts/help-context';
import { IllustratedTooltip } from '@/components/ui/help-tooltip';
import { HelpCircle } from 'lucide-react';

type HelpTopicKey = keyof typeof HELP_TOPICS;
type HelpTopicValue = typeof HELP_TOPICS[HelpTopicKey];

interface ContextualHelpProps {
  topic: HelpTopicValue;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  iconSize?: number;
}

export function ContextualHelp({ 
  topic, 
  side = "top", 
  align = "center", 
  className = "",
  iconSize = 16
}: ContextualHelpProps) {
  const { isHelpEnabled, getHelpItem, showTooltips } = useHelp();
  
  // If help is disabled, don't render anything
  if (!isHelpEnabled || !showTooltips) {
    return null;
  }
  
  const helpItem = getHelpItem(topic);
  
  if (!helpItem) {
    return null;
  }
  
  return (
    <IllustratedTooltip
      title={helpItem.title}
      content={helpItem.content}
      illustration={helpItem.illustration}
      side={side}
      align={align}
      className={className}
      iconSize={iconSize}
      icon={<HelpCircle size={iconSize} className="text-primary hover:text-primary/80 transition-colors" />}
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