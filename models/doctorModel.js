const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  doctorName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNo: { type: String, required: true },
  password: { type: String, required: true },
  patients: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Patient",
    default: [],
  },
  previousPrescriptions: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Prescription",
    default: [],
  },
  clinicName: { type: String },
  clinicAddress: {
    addressLine1: { type: String },
    addressLine2: { type: String },
    pincode: { type: String },
    city: { type: String },
    state: { type: String },
  },
  signature: { type: String },
});

const Doctor = mongoose.model("Doctor", doctorSchema);
module.exports = Doctor;
