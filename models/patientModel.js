const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  sex: { type: String, required: true },
  phone: { type: String, required: true },
  medicalHistory: { type: [String], default: [] },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  previousPrescriptions: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Prescription",
    default: [],
  },
});

const Patient = mongoose.model("Patient", patientSchema);
module.exports = Patient;
