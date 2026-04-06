const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// POST /api/study-strategist/plan - Generate study plan
router.post('/plan', verifyToken, async (req, res) => {
  try {
    const { 
      examName, 
      daysUntilExam, 
      hoursPerWeek, 
      weakAreas, 
      prepLevel, 
      goalBrief 
    } = req.body;

    if (!examName || !daysUntilExam || !hoursPerWeek) {
      return res.status(400).json({
        success: false,
        message: 'examName, daysUntilExam, and hoursPerWeek are required'
      });
    }

    const weeksUntilExam = Math.ceil(daysUntilExam / 7);
    const totalHours = weeksUntilExam * hoursPerWeek;

    // Generate personalized study plan
    const plan = generateStudyPlan({
      examName,
      weeksUntilExam,
      hoursPerWeek,
      totalHours,
      weakAreas,
      prepLevel,
      goalBrief
    });

    res.json({
      success: true,
      plan,
      meta: {
        examName,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Study strategist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate study plan'
    });
  }
});

function generateStudyPlan({ examName, weeksUntilExam, hoursPerWeek, totalHours, weakAreas, prepLevel, goalBrief }) {
  const phases = Math.min(weeksUntilExam, 3);
  const weeklyPhases = [];
  
  const phaseNames = ['Foundation & Weak Areas', 'Intensive Practice & Expansion', 'The Final Sprint'];
  const phaseThemes = ['Core Concepts', 'Practice & Application', 'Revision & Mock Tests'];

  for (let i = 0; i < phases; i++) {
    const weekNum = i + 1;
    const hoursSuggested = hoursPerWeek;
    
    weeklyPhases.push({
      week: weekNum,
      theme: phaseThemes[i] || 'Comprehensive Study',
      phase: phaseNames[i] || 'Study Phase',
      hoursSuggested,
      focusAreas: generateFocusAreas(i, weakAreas, examName),
      milestones: generateMilestones(i, examName),
      scholarStockTip: generateScholarStockTip(i)
    });
  }

  return {
    title: `Your Personalized ${examName} Study Plan`,
    executiveSummary: `A comprehensive ${weeksUntilExam}-week roadmap targeting ${goalBrief || 'maximum score'} with ${hoursPerWeek} hours/week study schedule.`,
    prepStageLabel: prepLevel || 'intermediate',
    stats: {
      estimatedTotalHours: totalHours,
      weeklyIntensity: hoursPerWeek > 20 ? 'High' : hoursPerWeek > 10 ? 'Moderate' : 'Light',
      readinessProjection: weeksUntilExam > 12 
        ? 'Excellent preparation time. Focus on deep understanding.' 
        : weeksUntilExam > 6 
        ? 'Good time frame. Balance speed with accuracy.' 
        : 'Intensive mode required. Prioritize high-yield topics.'
    },
    weeklyPhases,
    dailyHabits: [
      'Review previous day\'s notes for 15 minutes',
      'Solve at least 20-30 practice questions daily',
      'Take short breaks every 45-50 minutes',
      'Maintain a mistake journal for weak areas',
      'Sleep 7-8 hours for optimal retention'
    ],
    finalWeekPlan: [
      'Focus exclusively on revision and mock tests',
      'Avoid learning new topics',
      'Practice time management with full-length tests',
      'Review all mistakes from your journal',
      'Stay calm and confident!'
    ],
    riskAlerts: generateRiskAlerts(weeksUntilExam, hoursPerWeek, prepLevel),
    motivationLine: generateMotivationLine(examName)
  };
}

function generateFocusAreas(phaseIndex, weakAreas, examName) {
  const commonAreas = {
    0: weakAreas ? weakAreas.split(',').map(s => s.trim()).slice(0, 3) : ['Fundamentals', 'Basic Concepts', 'Theory'],
    1: ['Problem Solving', 'Application', 'Previous Year Questions'],
    2: ['Mock Tests', 'Revision', 'Time Management']
  };
  return commonAreas[phaseIndex] || ['Comprehensive Study'];
}

function generateMilestones(phaseIndex, examName) {
  const milestones = {
    0: [
      'Complete syllabus coverage of weak areas',
      'Build strong conceptual foundation',
      'Solve 100+ basic level problems'
    ],
    1: [
      'Attempt 5+ previous year papers',
      'Improve speed and accuracy',
      'Master intermediate difficulty problems'
    ],
    2: [
      'Score 80%+ in mock tests',
      'Perfect time management',
      'Zero doubts remaining'
    ]
  };
  return milestones[phaseIndex] || ['Stay consistent with your schedule'];
}

function generateScholarStockTip(phaseIndex) {
  const tips = [
    'Use our topic-wise PYQ collections to strengthen fundamentals.',
    'Practice with our AI-generated mock tests for this phase.',
    'Access premium shortcut formula sheets in your Library.'
  ];
  return tips[phaseIndex] || 'Utilize our target materials for this phase.';
}

function generateRiskAlerts(weeksUntilExam, hoursPerWeek, prepLevel) {
  const risks = [];
  
  if (weeksUntilExam < 4) {
    risks.push({
      risk: 'Limited Time Available',
      mitigation: 'Focus only on high-weightage topics. Skip low-yield chapters.'
    });
  }
  
  if (hoursPerWeek < 10) {
    risks.push({
      risk: 'Low Study Hours',
      mitigation: 'Increase daily study time or extend preparation period if possible.'
    });
  }
  
  if (prepLevel === 'beginner' && weeksUntilExam < 8) {
    risks.push({
      risk: 'Beginner with Tight Schedule',
      mitigation: 'Consider postponing exam if possible, or focus on crash course materials.'
    });
  }
  
  return risks;
}

function generateMotivationLine(examName) {
  const lines = [
    `Success in ${examName} is not about being the best, it's about being better than you were yesterday.`,
    `Every hour you study brings you closer to your dream ${examName} rank.`,
    `The pain of discipline is nothing compared to the pain of regret. Keep going!`,
    `Your ${examName} preparation journey is shaping you into a stronger person.`,
    `Believe in yourself. You are capable of achieving greatness in ${examName}!`
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

module.exports = router;
