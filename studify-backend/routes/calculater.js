const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// POST /api/calculator/solve - AI Calculator explanation endpoint
router.post('/solve', verifyToken, async (req, res) => {
  try {
    const { problem, history = [] } = req.body;

    if (!problem || typeof problem !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Problem is required'
      });
    }

    const explanation = generateExplanation(problem, history);

    res.json({
      success: true,
      result: explanation
    });
  } catch (error) {
    console.error('Calculator AI error:', error);
    res.status(500).json({
      success: false,
      message: 'Calculator service temporarily unavailable'
    });
  }
});

function generateExplanation(problem, history) {
  // Detect problem type
  const lowerProblem = problem.toLowerCase();
  
  if (lowerProblem.includes('explain:')) {
    const expr = problem.replace('Explain:', '').trim();
    return generateMathExplanation(expr);
  }
  
  if (lowerProblem.includes('derivative') || lowerProblem.includes('d/dx')) {
    return generateCalculusExplanation(problem, 'derivative');
  }
  
  if (lowerProblem.includes('integral') || lowerProblem.includes('∫')) {
    return generateCalculusExplanation(problem, 'integral');
  }
  
  if (lowerProblem.includes('matrix') || lowerProblem.includes('det')) {
    return generateLinearAlgebraExplanation(problem);
  }
  
  if (lowerProblem.includes('probability') || lowerProblem.includes('stats')) {
    return generateStatisticsExplanation(problem);
  }
  
  // Default math explanation
  return generateMathExplanation(problem);
}

function generateMathExplanation(expression) {
  return `📐 **Step-by-Step Solution**

**Problem:** ${expression}

**Approach:**
1. Identify the type of mathematical operation needed
2. Apply relevant formulas or methods
3. Perform calculations carefully
4. Verify the result

**Key Concepts:**
• Break complex expressions into simpler parts
• Follow order of operations (PEMDAS/BODMAS)
• Check units and signs at each step
• Use approximations to verify reasonableness

**Study Tip:** 💡
Practice similar problems to build muscle memory. Understanding the 'why' behind each step is more important than memorizing the solution.

**Related Topics to Review:**
• Algebraic manipulation
• Numerical computation
• Error checking techniques`;
}

function generateCalculusExplanation(problem, type) {
  if (type === 'derivative') {
    return `📈 **Derivative Solution**

**Problem:** ${problem}

**Step-by-Step Method:**
1. Identify the function to differentiate
2. Apply differentiation rules:
   - Power rule: d/dx(x^n) = n·x^(n-1)
   - Product rule: d/dx(uv) = u'v + uv'
   - Chain rule: d/dx(f(g(x))) = f'(g(x))·g'(x)
3. Simplify the resulting expression
4. Check by verifying critical points

**Common Mistakes to Avoid:**
• Forgetting to apply chain rule for composite functions
• Sign errors when differentiating negative terms
• Incorrectly handling constants

**Practice Recommendation:**
Solve 5-10 similar derivative problems to master the technique.`;
  }
  
  return `∫ **Integral Solution**

**Problem:** ${problem}

**Integration Strategy:**
1. Identify the integrand form
2. Choose appropriate technique:
   - Direct integration (power rule)
   - Substitution method
   - Integration by parts
   - Partial fractions
3. Apply the method systematically
4. Add constant of integration (+C)
5. Verify by differentiation

**Key Formulas:**
• ∫x^n dx = x^(n+1)/(n+1) + C (n ≠ -1)
• ∫1/x dx = ln|x| + C
• ∫e^x dx = e^x + C

**Tip:** Always verify your answer by differentiating!`;
}

function generateLinearAlgebraExplanation(problem) {
  return `🔢 **Linear Algebra Solution**

**Problem:** ${problem}

**Systematic Approach:**
1. Identify matrix dimensions and properties
2. Choose appropriate method:
   - Row reduction for systems
   - Cofactor expansion for determinants
   - Characteristic equation for eigenvalues
3. Perform calculations step-by-step
4. Verify results using alternative methods

**Important Concepts:**
• Matrix operations follow specific rules
• Determinants reveal matrix invertibility
• Eigenvalues have geometric significance

**Exam Strategy:**
For JEE/GATE, focus on:
- 2×2 and 3×3 matrix operations
- Properties of determinants
- System of linear equations`;
}

function generateStatisticsExplanation(problem) {
  return `📊 **Statistics Solution**

**Problem:** ${problem}

**Analysis Framework:**
1. Identify given data and what to find
2. Choose appropriate statistical measure:
   - Central tendency (mean, median, mode)
   - Dispersion (variance, standard deviation)
   - Probability distributions
3. Apply formulas correctly
4. Interpret results in context

**Key Formulas:**
• Mean: x̄ = Σx/n
• Variance: σ² = Σ(x-x̄)²/n
• Standard Deviation: σ = √σ²

**Common Applications:**
• Data interpretation in DI sections
• Probability in quantitative aptitude
• Statistical inference in research

**Practice Focus:**
Work on previous year CAT/GMAT problems for data interpretation.`;
}

module.exports = router;
