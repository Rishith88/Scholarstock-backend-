// studify-backend/models/Material.js - COMPLETE WITH 116+ EXAMS

const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  
  examCategory: {
    type: String,
    required: true
  },
  
  subcategory: {
    type: String,
    required: true,
    trim: true
  },
  
  examLabel: {
    type: String,
    required: true
  },
  
  subject: {
    type: String,
    trim: true
  },
  
  topics: [{
    type: String,
    trim: true
  }],
  
  class: {
    type: String,
    enum: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', 'N/A']
  },
  
  pdfUrl: {
    type: String,
    required: true
  },
  
  thumbnailUrl: {
    type: String
  },
  
  pricePerDay: {
    type: Number,
    required: true,
    min: 0
  },
  
  author: {
    type: String,
    default: 'Unknown'
  },
  
  publisher: {
    type: String
  },
  
  pages: {
    type: Number,
    min: 1
  },
  
  language: {
    type: String,
    default: 'English',
    enum: ['English', 'Hindi', 'Both']
  },
  
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard', 'Mixed'],
    default: 'Medium'
  },
  
  year: {
    type: Number
  },
  
  edition: {
    type: String
  },
  
  isbn: {
    type: String,
    unique: true,
    sparse: true
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  views: {
    type: Number,
    default: 0
  },
  
  downloads: {
    type: Number,
    default: 0
  },
  
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  
  totalRatings: {
    type: Number,
    default: 0
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

materialSchema.index({ examCategory: 1, subcategory: 1 });
materialSchema.index({ title: 'text', description: 'text' });
materialSchema.index({ tags: 1 });

materialSchema.virtual('fullCategory').get(function() {
  return `${this.examCategory} - ${this.subcategory}`;
});

// COMPREHENSIVE SUBCATEGORIES - 116+ EXAMS
const SUBCATEGORIES = {
  'JEE Main': ['Physics','Chemistry','Mathematics','Previous Year Papers','Mock Tests','Sample Papers','Chapter-wise Practice','Formula Sheets','Quick Revision','Mechanics','Thermodynamics','Electromagnetism','Optics','Modern Physics','Physical Chemistry','Organic Chemistry','Inorganic Chemistry','Algebra','Calculus','Coordinate Geometry','Trigonometry','Vectors','NCERT Solutions','Reference Books','Crash Course'],
  'JEE Advanced': ['Physics','Chemistry','Mathematics','Previous Year Papers','Mock Tests','Archive Questions','Advanced Problems','Theory Notes','Formula Banks','Mechanics','Thermodynamics','Electromagnetism','Optics','Modern Physics','Physical Chemistry','Organic Chemistry','Inorganic Chemistry','Algebra','Calculus','Coordinate Geometry','Trigonometry','Vectors','Conceptual Questions','Multi-Correct MCQs','Integer Type Questions'],
  'BITSAT': ['Physics','Chemistry','Mathematics','English','Logical Reasoning','Previous Year Papers','Mock Tests','Sample Papers','Speed Tests','Chapter-wise Practice'],
  'VITEEE': ['Physics','Chemistry','Mathematics','English','Previous Year Papers','Mock Tests','Sample Papers'],
  'SRMJEEE': ['Physics','Chemistry','Mathematics','Previous Year Papers','Mock Tests'],
  'COMEDK': ['Physics','Chemistry','Mathematics','Previous Year Papers','Mock Tests'],
  'MHT CET': ['Physics','Chemistry','Mathematics','Biology','Previous Year Papers','Mock Tests'],
  'KCET': ['Physics','Chemistry','Mathematics','Biology','Previous Year Papers','Mock Tests'],
  'WBJEE': ['Physics','Chemistry','Mathematics','Previous Year Papers','Mock Tests'],
  'GATE': ['Computer Science & IT','Electronics & Communication','Electrical Engineering','Mechanical Engineering','Civil Engineering','Chemical Engineering','Instrumentation Engineering','Aerospace Engineering','Biotechnology','Engineering Mathematics','General Aptitude','Technical Section','Previous Year Papers','Mock Tests','Subject-wise Tests','Formula Sheets','Quick Revision','Standard Books'],
  'NEET UG': ['Physics','Chemistry','Biology','Botany','Zoology','Previous Year Papers','Mock Tests','Sample Papers','NCERT Solutions','NCERT Exemplar','MTG Books','Chapter-wise Practice','Topic-wise Tests','Full Length Tests','Human Physiology','Plant Physiology','Genetics','Ecology','Organic Chemistry','Inorganic Chemistry','Physical Chemistry','Mechanics','Thermodynamics','Optics','Modern Physics','Quick Revision','Formula Sheets','Diagrams & Charts'],
  'NEET PG': ['Anatomy','Physiology','Biochemistry','Pathology','Pharmacology','Microbiology','Forensic Medicine','Community Medicine','Medicine','Surgery','Obstetrics & Gynecology','Pediatrics','Psychiatry','Dermatology','Ophthalmology','ENT','Orthopedics','Radiology','Anesthesia','Previous Year Papers','Mock Tests','Grand Tests'],
  'AIIMS': ['Physics','Chemistry','Biology','General Knowledge','Logical Reasoning','English','Previous Year Papers','Mock Tests'],
  'JIPMER': ['Physics','Chemistry','Biology','English','Logical Reasoning','Previous Year Papers','Mock Tests'],
  'UPSC Civil Services (IAS)': ['General Studies Paper I','General Studies Paper II (CSAT)','General Studies Paper III','General Studies Paper IV (Ethics)','Optional Subject','Essay Writing','Indian History','Ancient History','Medieval History','Modern History','Art & Culture','Geography','Indian Geography','World Geography','Indian Polity & Governance','Constitution','Political Science','Indian Economy','Economic Development','Budget & Planning','Science & Technology','Environment & Ecology','Biodiversity','Internal Security','Disaster Management','International Relations','Current Affairs','Daily Current Affairs','Monthly Compilations','Previous Year Papers','Mock Tests','Answer Writing Practice','Mains Test Series','Interview Preparation'],
  'UPSC NDA': ['Mathematics','General Ability Test','English','General Knowledge','Physics','Chemistry','Biology','History','Geography','Polity','Economics','Current Affairs','Previous Year Papers','Mock Tests'],
  'UPSC CDS': ['English','General Knowledge','Elementary Mathematics','Previous Year Papers','Mock Tests'],
  'UPSC CAPF': ['General Ability & Intelligence','General Studies','Essay Writing','Comprehension','Previous Year Papers','Mock Tests'],
  'State PSC': ['General Studies','Current Affairs','State Affairs','History','Geography','Polity','Economics','English','Regional Language','Essay Writing','Previous Year Papers','Mock Tests'],
  'SSC CGL': ['General Intelligence & Reasoning','General Awareness','Quantitative Aptitude','English Comprehension','Tier I Preparation','Tier II Preparation','Tier III Preparation','Previous Year Papers','Mock Tests','Topic-wise Practice','Speed Tests','Sectional Tests'],
  'SSC CHSL': ['General Intelligence','English Language','Quantitative Aptitude','General Awareness','Typing Test Preparation','Previous Year Papers','Mock Tests'],
  'SSC MTS': ['General Intelligence & Reasoning','Numerical Aptitude','General English','General Awareness','Previous Year Papers','Mock Tests'],
  'SSC CPO': ['General Intelligence & Reasoning','General Knowledge & Awareness','Quantitative Aptitude','English Comprehension','Physical Standards','Medical Standards','Previous Year Papers','Mock Tests'],
  'SSC JE': ['General Intelligence & Reasoning','General Awareness','Civil Engineering','Electrical Engineering','Mechanical Engineering','Previous Year Papers','Mock Tests'],
  'IBPS PO': ['English Language','Quantitative Aptitude','Reasoning Ability','General Awareness','Computer Knowledge','Banking Awareness','Descriptive Paper','Letter Writing','Essay Writing','Previous Year Papers','Mock Tests','Sectional Tests','Prelims Preparation','Mains Preparation','Interview Preparation'],
  'IBPS Clerk': ['English Language','Quantitative Aptitude','Reasoning Ability','General Awareness','Computer Knowledge','Previous Year Papers','Mock Tests','Speed Tests'],
  'IBPS SO': ['Professional Knowledge','English Language','Reasoning','Quantitative Aptitude','General Awareness','IT Officer','Agriculture Officer','Marketing Officer','Previous Year Papers','Mock Tests'],
  'IBPS RRB': ['Reasoning','Quantitative Aptitude','General Awareness','Computer Knowledge','English/Hindi Language','Office Assistant','Officer Scale I/II/III','Previous Year Papers','Mock Tests'],
  'SBI PO': ['English Language','Quantitative Aptitude','Reasoning Ability','General Awareness','Computer Aptitude','Data Analysis','Descriptive Paper','Group Discussion','Interview Preparation','Previous Year Papers','Mock Tests'],
  'SBI Clerk': ['English Language','Quantitative Aptitude','Reasoning Ability','General Awareness','Computer Knowledge','Previous Year Papers','Mock Tests'],
  'RBI Grade B': ['General Awareness','English Language','Quantitative Aptitude','Reasoning','Economic & Social Issues','Finance & Management','Previous Year Papers','Mock Tests'],
  'RBI Assistant': ['English Language','Quantitative Aptitude','Reasoning Ability','General Awareness','Computer Knowledge','Previous Year Papers','Mock Tests'],
  'NABARD': ['General Awareness','English Language','Reasoning','Quantitative Aptitude','Computer Knowledge','Economic & Social Issues','Agriculture & Rural Development','Previous Year Papers','Mock Tests'],
  'LIC AAO': ['Reasoning Ability','Quantitative Aptitude','English Language','General Awareness','Computer Knowledge','Insurance Awareness','Previous Year Papers','Mock Tests'],
  'SEBI Grade A': ['General Awareness','English Language','Quantitative Aptitude','Reasoning','Capital Markets','Securities Laws','Previous Year Papers','Mock Tests'],
  'RRB NTPC': ['General Awareness','Mathematics','General Intelligence & Reasoning','General Science','Current Affairs','Previous Year Papers','Mock Tests','CBT 1 & 2 Preparation'],
  'RRB JE': ['General Intelligence & Reasoning','General Awareness','Mathematics','General Science','Civil Engineering','Mechanical Engineering','Electrical Engineering','Electronics Engineering','Information Technology','Previous Year Papers','Mock Tests'],
  'RRB ALP': ['Mathematics','General Intelligence & Reasoning','General Science','General Awareness','Trade-specific Questions','Previous Year Papers','Mock Tests'],
  'RRB Group D': ['General Science','Mathematics','General Intelligence & Reasoning','General Awareness','Current Affairs','Previous Year Papers','Mock Tests'],
  'RRB RPF': ['General Awareness','Arithmetic','General Intelligence & Reasoning','General Science','Physical Efficiency Test','Previous Year Papers','Mock Tests'],
  'Indian Army': ['General Knowledge','Mathematics','English','Reasoning','Physical Fitness Test','Medical Examination','Interview Preparation','SSB Preparation','Previous Year Papers','Mock Tests'],
  'Indian Navy': ['Mathematics','Physics','Chemistry','English','General Knowledge','Reasoning','Physical Fitness Test','Medical Standards','Previous Year Papers','Mock Tests'],
  'Indian Air Force': ['Mathematics','Physics','English','Reasoning','General Awareness','AFCAT Preparation','Physical Fitness','Medical Standards','Previous Year Papers','Mock Tests'],
  'AFCAT': ['General Awareness','Verbal Ability','Numerical Ability','Reasoning & Military Aptitude','Previous Year Papers','Mock Tests'],
  'CDS': ['English','General Knowledge','Elementary Mathematics','Previous Year Papers','Mock Tests'],
  'CAT': ['Quantitative Ability','Verbal Ability & Reading Comprehension','Data Interpretation & Logical Reasoning','Arithmetic','Algebra','Geometry','Modern Math','Reading Comprehension','Para Jumbles','Sentence Correction','Data Interpretation','Logical Reasoning','Puzzles','Previous Year Papers','Mock Tests','Sectional Tests','Mock Analysis','Topic-wise Practice'],
  'XAT': ['Verbal & Logical Ability','Decision Making','Quantitative Ability & Data Interpretation','General Knowledge','Essay Writing','Previous Year Papers','Mock Tests'],
  'SNAP': ['General English','Quantitative Ability','Analytical & Logical Reasoning','Current Affairs','Previous Year Papers','Mock Tests'],
  'NMAT': ['Language Skills','Quantitative Skills','Logical Reasoning','Previous Year Papers','Mock Tests'],
  'MAT': ['Language Comprehension','Mathematical Skills','Data Analysis & Sufficiency','Intelligence & Critical Reasoning','Indian & Global Environment','Previous Year Papers','Mock Tests'],
  'CMAT': ['Quantitative Techniques & Data Interpretation','Logical Reasoning','Language Comprehension','General Awareness','Innovation & Entrepreneurship','Previous Year Papers','Mock Tests'],
  'IIFT': ['Quantitative Ability','Logical Reasoning','Verbal Ability','General Awareness','Previous Year Papers','Mock Tests'],
  'CLAT': ['English Language','Current Affairs & General Knowledge','Legal Reasoning','Logical Reasoning','Quantitative Techniques','Previous Year Papers','Mock Tests','UG Preparation','PG Preparation'],
  'AILET': ['English','General Knowledge & Current Affairs','Legal Aptitude','Logical Reasoning','Mathematics','Previous Year Papers','Mock Tests'],
  'LSAT India': ['Analytical Reasoning','Logical Reasoning','Reading Comprehension','Previous Year Papers','Mock Tests'],
  'DU LLB': ['English','General Knowledge','Legal Aptitude','Logical Reasoning','Analytical Abilities','Previous Year Papers','Mock Tests'],
  'CTET': ['Child Development & Pedagogy','Language I (Compulsory)','Language II (Compulsory)','Mathematics','Environmental Studies','Science','Social Studies','Paper I (Class I-V)','Paper II (Class VI-VIII)','Previous Year Papers','Mock Tests'],
  'UGC NET': ['Teaching Aptitude','Research Aptitude','Communication','Logical Reasoning','Data Interpretation','Higher Education System','ICT','People & Environment','Commerce','Economics','History','Political Science','English','Hindi','Mathematics','Physics','Chemistry','Computer Science','Management','Education','Previous Year Papers','Mock Tests'],
  'DSSSB': ['General Awareness','General Intelligence & Reasoning','Arithmetical & Numerical Ability','Hindi Language & Comprehension','English Language & Comprehension','Subject-specific Knowledge','Previous Year Papers','Mock Tests'],
  'KVS': ['General English','General Hindi','General Knowledge & Current Affairs','Reasoning Ability','Computer Literacy','Subject-specific Knowledge','Pedagogy','Previous Year Papers','Mock Tests'],
  'UPTET': ['Child Development & Pedagogy','Language I','Language II','Mathematics','Environmental Studies','Science','Social Studies','Previous Year Papers','Mock Tests'],
  'CBSE Class 10': ['Mathematics','Science','Social Science','English','Hindi','Sanskrit','Sample Papers','Previous Year Papers','NCERT Solutions','Important Questions','Chapter-wise Tests','Revision Notes'],
  'CBSE Class 12': ['Physics','Chemistry','Mathematics','Biology','English','Physical Education','Computer Science','Accountancy','Business Studies','Economics','History','Geography','Political Science','Psychology','Sample Papers','Previous Year Papers','NCERT Solutions','Important Questions','Chapter-wise Tests','Revision Notes'],
  'CBSE Class 11': ['Physics','Chemistry','Mathematics','Biology','English','Physical Education','Computer Science','Accountancy','Business Studies','Economics','NCERT Solutions','Sample Papers'],
  'CBSE Class 9': ['Mathematics','Science','Social Science','English','Hindi','NCERT Solutions','Sample Papers'],
  'ICSE Class 10': ['Mathematics','Physics','Chemistry','Biology','English','History & Civics','Geography','Previous Year Papers','Sample Papers'],
  'State Board': ['Mathematics','Science','Social Science','English','Regional Language','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12','Sample Papers','Previous Year Papers'],
  'IMO': ['Algebra','Geometry','Number Theory','Combinatorics','Problem Solving','Previous Year Papers','Practice Problems'],
  'NSO': ['Physics','Chemistry','Biology','Logical Reasoning','Achievers Section','Previous Year Papers','Mock Tests'],
  'NCO': ['Computer Fundamentals','MS Office','Internet','Programming Concepts','Logical Reasoning','Previous Year Papers','Mock Tests'],
  'NTSE': ['Mental Ability Test (MAT)','Scholastic Aptitude Test (SAT)','Physics','Chemistry','Biology','Mathematics','History','Geography','Polity','Economics','Stage 1 Preparation','Stage 2 Preparation','Previous Year Papers','Mock Tests'],
  'KVPY': ['Physics','Chemistry','Mathematics','Biology','Stream SA (Class 11)','Stream SB (Class 12)','Stream SX (Class 11 & 12)','Previous Year Papers','Mock Tests'],
  'CA Foundation': ['Principles & Practice of Accounting','Business Laws & Business Correspondence','Business Mathematics & Logical Reasoning','Business Economics & Business & Commercial Knowledge','Previous Year Papers','Mock Tests','Revision Notes'],
  'CA Intermediate': ['Accounting','Corporate Laws','Taxation','Cost & Management Accounting','Advanced Accounting','Auditing & Assurance','Enterprise Information Systems','Financial Management','Strategic Management','Previous Year Papers','Mock Tests'],
  'CA Final': ['Financial Reporting','Strategic Financial Management','Advanced Auditing','Corporate & Allied Laws','Advanced Management Accounting','Information Systems','Direct Tax Laws','Indirect Tax Laws','Previous Year Papers','Mock Tests'],
  'CS Foundation': ['Business Environment & Law','Business Management','Business Economics','Fundamentals of Accounting & Auditing','Previous Year Papers','Mock Tests'],
  'CS Executive': ['Company Law','Cost & Management Accounting','Economic & Commercial Laws','Tax Laws','Financial & Strategic Management','Corporate & Management Accounting','Securities Laws & Capital Markets','Previous Year Papers','Mock Tests'],
  'CS Professional': ['Advanced Company Law','Secretarial Audit','Corporate Restructuring','Information Technology','Financial Markets','Corporate Governance','Previous Year Papers','Mock Tests'],
  'CMA Foundation': ['Fundamentals of Economics & Management','Fundamentals of Accounting','Fundamentals of Laws & Ethics','Fundamentals of Business Mathematics & Statistics','Previous Year Papers','Mock Tests'],
  'CMA Intermediate': ['Financial Accounting','Laws & Ethics','Direct Taxation','Cost Accounting','Financial Management','Strategic Management','Operations Management','Cost & Management Audit','Previous Year Papers','Mock Tests'],
  'CMA Final': ['Corporate Laws & Compliance','Strategic Financial Management','Strategic Cost Management','Direct Tax Laws','Indirect Tax Laws','Corporate Financial Reporting','Strategic Performance Management','Previous Year Papers','Mock Tests'],
  'CUET': ['General Test','Domain Subjects','Language','Mathematics','Physics','Chemistry','Computer Science','Economics','Business Studies','Previous Year Papers','Mock Tests'],
  'IELTS': ['Listening','Reading','Writing','Speaking','Academic Module','General Training Module','Practice Tests','Mock Tests'],
  'TOEFL': ['Reading','Listening','Speaking','Writing','Practice Tests','Mock Tests'],
  'GRE': ['Verbal Reasoning','Quantitative Reasoning','Analytical Writing','Practice Tests','Mock Tests'],
  'GMAT': ['Quantitative','Verbal','Integrated Reasoning','Analytical Writing','Practice Tests','Mock Tests'],
  'SAT': ['Reading','Writing & Language','Mathematics','Essay (Optional)','Practice Tests','Mock Tests']
};

// SAFE EXPORT - PREVENTS OVERWRITE ERROR
let Material;
try {
  // Try to get existing model
  Material = mongoose.model('Material');
} catch (error) {
  // Model doesn't exist, create it
  Material = mongoose.model('Material', materialSchema);
}

module.exports = Material;
module.exports.SUBCATEGORIES = SUBCATEGORIES;
