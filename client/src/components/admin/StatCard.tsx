import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  linkText: string;
  linkHref: string;
  iconBgClass: string;
  isLoading?: boolean;
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  icon,
  linkText,
  linkHref,
  iconBgClass,
  isLoading = false,
  onClick
}: StatCardProps) {
  const [, navigate] = useLocation();
  
  // Handle card click function
  const handleClick = () => {
    // First call the provided onClick handler if it exists
    if (onClick) {
      onClick();
    }
    
    // If we have a hash in the linkHref, handle it specially
    if (linkHref.startsWith('#')) {
      // In the case of a hash link, just make sure the page doesn't scroll
      // The onClick handler should take care of navigating to the correct tab
      return;
    }
    
    // Otherwise navigate using wouter
    navigate(linkHref);
  };
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center mb-3">
          <div className={`${iconBgClass} p-2 rounded-full mr-3 text-neutral-700`}>
            {icon}
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-9 w-24 mb-3" />
        ) : (
          <p className="text-3xl font-bold mb-3">{value}</p>
        )}
        
        <button 
          onClick={handleClick}
          className="mt-auto text-left cursor-pointer border-0 bg-transparent p-0"
        >
          <span className="text-secondary text-sm hover:underline">{linkText}</span>
        </button>
      </CardContent>
    </Card>
  );
}
