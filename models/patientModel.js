const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: {
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
  },
  age: { type: Number, required: true },
  sex: { type: String, required: true },
  phone: { type: String, required: true },
  mail: { type: String, required: true },
  guardianName: { type: String, required: true },
  height: { type: String, required: true },
  weight: { type: String, required: true },
  pulse: { type: String, required: true },
  bp: { type: String, required: true },
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
