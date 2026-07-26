import { useState } from 'react';
import type { ProctorLogEvent, Test } from '../types';
import ExamScreen from './ExamScreen';
import LiveProctoringEventBridge from './LiveProctoringEventBridge';
import SecureExamIntegrityPreflight from './SecureExamIntegrityPreflight';

interface ExamExperienceProps {
  test: Test;
  studentName: string;
  simType: string;
  onSubmitExam: (answers: Record<string, number>, logs: ProctorLogEvent[], tabAwayCount: number) => void;
  onExitExam: () => void;
}

export default function ExamExperience(props: ExamExperienceProps) {
  const [activeTest, setActiveTest] = useState(props.test);

  if (activeTest.proctorPreflightRequired) {
    return (
      <SecureExamIntegrityPreflight
        test={activeTest}
        onReady={setActiveTest}
        onCancel={props.onExitExam}
      />
    );
  }

  return (
    <>
      <LiveProctoringEventBridge
        proctoringSessionId={activeTest.proctoringSessionId}
        policy={activeTest.proctoringPolicy}
      />
      <ExamScreen {...props} test={activeTest} />
    </>
  );
}
