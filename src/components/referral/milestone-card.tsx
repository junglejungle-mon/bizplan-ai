"use client";

import { Trophy, Lock, Check } from "lucide-react";

interface Milestone {
  count: number;
  reward: string;
  description: string;
  achieved: boolean;
}

interface MilestoneCardProps {
  milestones: Milestone[];
  currentReferrals: number;
}

export function MilestoneCard({ milestones, currentReferrals }: MilestoneCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Trophy className="h-5 w-5 text-yellow-500" />
        마일스톤 보상
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        더 많이 추천할수록 더 큰 보상을 받으세요
      </p>

      <div className="mt-6 space-y-4">
        {milestones.map((milestone) => {
          const progress = Math.min(100, (currentReferrals / milestone.count) * 100);

          return (
            <div
              key={milestone.count}
              className={`rounded-lg border p-4 transition-colors ${
                milestone.achieved
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {milestone.achieved ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {milestone.count}명 추천 달성
                    </p>
                    <p className="text-xs text-gray-500">
                      {milestone.description}
                    </p>
                  </div>
                </div>
                {milestone.achieved && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    달성!
                  </span>
                )}
              </div>

              {!milestone.achieved && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{currentReferrals}명</span>
                    <span>{milestone.count}명</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
