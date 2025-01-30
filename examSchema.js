const mongoose = require('mongoose');

// Define the schema for an individual question
const questionSchema = new mongoose.Schema({
  questionNo: { type: String, default: '' }, // Question number (optional)
  questionText: { type: String, default: '' }, // Text for the question
  questionImage: { type: String, default: '' }, // Base64 or file path for the question image (optional)
  optionA: { type: String, default: '' }, // Optional Option A (text and image)
  optionAImage: { type: String, default: '' }, // Optional base64 or file path for option A image
  optionB: { type: String, default: '' }, // Optional Option B (text and image)
  optionBImage: { type: String, default: '' }, // Optional base64 or file path for option B image
  optionC: { type: String, default: '' }, // Optional Option C (text and image)
  optionCImage: { type: String, default: '' }, // Optional base64 or file path for option C image
  optionD: { type: String, default: '' }, // Optional Option D (text and image)
  optionDImage: { type: String, default: '' }, // Optional base64 or file path for option D image
  correctAnswer: { type: String, default: '' }, // Store the correct answer (could be Option A/B/C/D, etc.)
  explanation: { type: String, default: '' }, // Explanation for the answer (optional)
  explanationImage: { type: String, default: '' }, // Optional image for the explanation (base64 or file path)
});

// Create the Exam schema
const examSchema = new mongoose.Schema({
  examId: { type: String }, // Add examId directly here
  examName: { type: String, trim: true }, // Name of the exam
  questions: [questionSchema], // Array of questions
  createdAt: { type: Date, default: Date.now },
});

// Create the Exam model
const Exam = mongoose.model('Exam', examSchema);

module.exports = Exam;
