'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, BookOpen, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface SubstitutionCardProps {
  request: {
    id: string;
    originalTeacher: string;
    period: {
      id: string;
      subject: string;
      className: string;
      roomName?: string;
      startTime: string;
      endTime: string;
      periodType: 'teaching' | 'rest' | 'prep' | 'break' | 'lunch';
    };
    fairnessRanking: Array<{
      teacherId: string;
      teacherName: string;
      fairnessIndex: number;
      expertiseMatch: boolean;
    }>;
    status: 'pending' | 'assigned' | 'accepted' | 'declined' | 'expired';
    expirationTime: string;
  };
  onAssign?: (teacherId: string) => void;
  onAccept?: () => void;
  onDecline?: () => void;
  showActions?: boolean;
}

export default function SubstitutionCard({ 
  request, 
  onAssign, 
  onAccept, 
  onDecline,
  showActions = true 
}: SubstitutionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'assigned': return 'bg-blue-100 text-blue-700';
      case 'accepted': return 'bg-green-100 text-green-700';
      case 'declined': return 'bg-red-100 text-red-700';
      case 'expired': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const topCandidate = request.fairnessRanking[0];
  const isExpired = new Date(request.expirationTime) < new Date();

  return (
    <Card className="rounded-2xl border-none shadow-soft overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-lg">{request.period.subject}</h3>
              <Badge className={`text-xs ${getStatusColor(request.status)}`}>
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span>Original: {request.originalTeacher}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>{request.period.startTime} - {request.period.endTime}</span>
              </div>
              {request.period.roomName && (
                <div className="text-xs">Room: {request.period.roomName}</div>
              )}
            </div>
          </div>
          {isExpired && (
            <Badge variant="destructive" className="text-xs">
              Expired
            </Badge>
          )}
        </div>

        {/* Fairness Ranking Display */}
        {request.fairnessRanking.length > 0 && (
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Fairness Ranking</span>
            </div>
            <div className="space-y-2">
              {request.fairnessRanking.slice(0, 3).map((candidate, index) => (
                <div
                  key={candidate.teacherId}
                  className={`p-3 rounded-xl border transition-all ${
                    index === 0 
                      ? 'bg-primary/5 border-primary/30' 
                      : 'bg-secondary/20 border-secondary/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{candidate.teacherName}</div>
                        <div className="text-xs text-muted-foreground">
                          Workload: {candidate.fairnessIndex} periods
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {candidate.expertiseMatch && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          Expert
                        </Badge>
                      )}
                      {showActions && onAssign && request.status === 'pending' && (
                        <Button
                          size="sm"
                          variant={index === 0 ? "default" : "outline"}
                          className="rounded-lg"
                          onClick={() => onAssign(candidate.teacherId)}
                        >
                          Assign
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons for Assigned Teacher */}
        {showActions && request.status === 'assigned' && (onAccept || onDecline) && (
          <div className="flex gap-2 mt-4">
            {onAccept && (
              <Button
                className="flex-1 rounded-xl bg-green-600 hover:bg-green-700"
                onClick={onAccept}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Accept
              </Button>
            )}
            {onDecline && (
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-red-300 text-red-600 hover:bg-red-50"
                onClick={onDecline}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Decline
              </Button>
            )}
          </div>
        )}

        {/* Expiration Warning */}
        {!isExpired && request.status === 'pending' && (
          <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
            <Clock className="inline h-3 w-3 mr-1" />
            Expires: {new Date(request.expirationTime).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
