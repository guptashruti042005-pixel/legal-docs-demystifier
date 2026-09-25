const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  persona: {
    type: String,
    enum: ['student', 'business', 'lawyer', 'senior', 'default'],
    default: 'default'
  },
  language: {
    type: String,
    enum: ['en', 'hi'],
    default: 'en'
  },
  confidenceScore: {
    type: Number,
    default: 1.0
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  analysis: {
    documentType: { type: String, default: 'General Legal Document' },
    executiveSummary: { type: String, default: '' },
    plainLanguageSummary: { type: String, default: '' },
    riskLevel: { type: String, default: 'low' },
    confidenceScore: { type: Number, default: 0.0 },
    importantClauses: { type: [mongoose.Schema.Types.Mixed], default: [] },
    redFlags: { type: [mongoose.Schema.Types.Mixed], default: [] },
    financialObligations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    importantDates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    missingClauses: { type: [mongoose.Schema.Types.Mixed], default: [] },
    recommendations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    atsScore: { type: Number, default: null },
    atsScoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    atsAssessment: { type: String, default: '' },
    skills: { type: [String], default: [] },
    extractedSkills: { type: [String], default: [] },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    personalInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    contactInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    education: { type: [mongoose.Schema.Types.Mixed], default: [] },
    experience: { type: [mongoose.Schema.Types.Mixed], default: [] },
    projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
    certifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
    achievements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    otherSections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    jobDescriptionMatch: { type: mongoose.Schema.Types.Mixed, default: null },
    resumeFeedback: { type: mongoose.Schema.Types.Mixed, default: {} },
    actionItems: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    hiddenCaveats: { type: [String], default: [] }
  },
  rawOutput: mongoose.Schema.Types.Mixed, // Storing raw output for debugging
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Analysis', AnalysisSchema);
