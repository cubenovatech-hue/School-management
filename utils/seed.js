require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const User = require("../models/User");
const SchoolClass = require("../models/SchoolClass");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Fee = require("../models/Fee");
const Lead = require("../models/Lead");
const { Book } = require("../models/Library");
const { Announcement, TimetableSlot } = require("../models/Misc");
const { Exam, Grade } = require("../models/Exam");
const Attendance = require("../models/Attendance");

async function run() {
  await connectDB();
  console.log("Clearing existing data...");
  await Promise.all([
    User.deleteMany({}),
    SchoolClass.deleteMany({}),
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    Fee.deleteMany({}),
    Lead.deleteMany({}),
    Book.deleteMany({}),
    Announcement.deleteMany({}),
    TimetableSlot.deleteMany({}),
    Exam.deleteMany({}),
    Grade.deleteMany({}),
    Attendance.deleteMany({}),
  ]);

  console.log("Creating classes...");
  const grade8A = await SchoolClass.create({ name: "Grade 8", section: "A", subjects: ["Math", "Science", "English", "History"], room: "201" });
  const grade9B = await SchoolClass.create({ name: "Grade 9", section: "B", subjects: ["Math", "Science", "English", "Geography"], room: "305" });

  console.log("Creating admin...");
  const admin = await User.create({
    name: "Meera Krishnan",
    email: "admin@school.io",
    password: "admin123",
    role: "admin",
    avatarColor: "#2F6D5E",
  });

  console.log("Creating teachers...");
  const teacherUser1 = await User.create({ name: "Rahul Verma", email: "teacher@school.io", password: "teacher123", role: "teacher", avatarColor: "#3A5BA0" });
  const teacher1 = await Teacher.create({
    employeeId: "T-001",
    name: "Rahul Verma",
    subjectSpecialty: "Mathematics",
    phone: "9876500001",
    email: "teacher@school.io",
    userAccount: teacherUser1._id,
    assignedClasses: [grade8A._id],
  });
  teacherUser1.teacherProfile = teacher1._id;
  await teacherUser1.save();
  grade8A.classTeacher = teacher1._id;
  await grade8A.save();

  const teacherUser2 = await User.create({ name: "Priya Nair", email: "priya@school.io", password: "teacher123", role: "teacher", avatarColor: "#3A5BA0" });
  const teacher2 = await Teacher.create({
    employeeId: "T-002",
    name: "Priya Nair",
    subjectSpecialty: "Science",
    email: "priya@school.io",
    userAccount: teacherUser2._id,
    assignedClasses: [grade9B._id],
  });
  teacherUser2.teacherProfile = teacher2._id;
  await teacherUser2.save();
  grade9B.classTeacher = teacher2._id;
  await grade9B.save();

  console.log("Creating students + parents...");
  const studentsData = [
    { name: "Arjun Shah", roll: "01", cls: grade8A, adm: "ADM-2024-001" },
    { name: "Divya Menon", roll: "02", cls: grade8A, adm: "ADM-2024-002" },
    { name: "Karthik Iyer", roll: "03", cls: grade8A, adm: "ADM-2024-003" },
    { name: "Sneha Reddy", roll: "01", cls: grade9B, adm: "ADM-2024-004" },
    { name: "Aman Gupta", roll: "02", cls: grade9B, adm: "ADM-2024-005" },
  ];

  const createdStudents = [];
  for (const s of studentsData) {
    const parentEmail = `${s.name.split(" ")[0].toLowerCase()}.parent@mail.com`;
    const parentUser = await User.create({
      name: `${s.name.split(" ")[0]}'s Guardian`,
      email: parentEmail,
      password: "parent123",
      role: "parent",
      avatarColor: "#8B4F9E",
    });

    const studentUserEmail = `${s.name.split(" ")[0].toLowerCase()}@school.io`;
    const studentUser = await User.create({
      name: s.name,
      email: studentUserEmail,
      password: "student123",
      role: "student",
      avatarColor: "#C97A2B",
    });

    const student = await Student.create({
      admissionNo: s.adm,
      name: s.name,
      schoolClass: s.cls._id,
      rollNo: s.roll,
      parentUser: parentUser._id,
      userAccount: studentUser._id,
      guardianPhone: "9876543210",
      guardianEmail: parentEmail,
      feeStructureAmount: 45000,
    });

    parentUser.children = [student._id];
    await parentUser.save();
    studentUser.studentProfile = student._id;
    await studentUser.save();

    await Fee.create({
      student: student._id,
      components: [
        { type: "tuition", label: "Tuition Fee", amount: 45000 },
        { type: "lab", label: "Lab Fee", amount: 3500 },
        { type: "transport", label: "Transport Fee", amount: 6000 },
      ],
      payments: [{ amount: 20000, method: "upi", note: "First installment" }],
    });

    createdStudents.push(student);
  }

  console.log("Creating attendance history (last 10 school days)...");
  const days = [];
  let d = new Date();
  while (days.length < 10) {
    d = new Date(d);
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      days.push(day);
    }
  }
  for (const student of createdStudents) {
    for (const day of days) {
      const roll = Math.random();
      const status = roll > 0.85 ? "absent" : roll > 0.78 ? "late" : "present";
      await Attendance.create({
        student: student._id,
        schoolClass: student.schoolClass,
        date: day,
        status,
        markedBy: teacher1._id,
      });
    }
  }

  console.log("Creating an exam + grades...");
  const exam = await Exam.create({ title: "Mid-Term 2026", schoolClass: grade8A._id, subject: "Mathematics", date: new Date(), maxMarks: 100 });
  const grade8Students = createdStudents.filter((s) => s.schoolClass.toString() === grade8A._id.toString());
  for (const s of grade8Students) {
    await Grade.create({ exam: exam._id, student: s._id, marksObtained: 60 + Math.floor(Math.random() * 35) });
  }

  console.log("Creating library books...");
  await Book.insertMany([
    { title: "Wings of Fire", author: "A.P.J. Abdul Kalam", isbn: "9788173711466", totalCopies: 5, availableCopies: 5 },
    { title: "The Discovery of India", author: "Jawaharlal Nehru", isbn: "9780143031031", totalCopies: 3, availableCopies: 3 },
    { title: "NCERT Mathematics Grade 8", author: "NCERT", isbn: "0000000001", totalCopies: 10, availableCopies: 10 },
  ]);

  console.log("Creating announcements...");
  await Announcement.create([
    { title: "Annual Sports Day", body: "Annual Sports Day will be held on the school grounds. All students must report by 8 AM in sports uniform.", audience: "all", postedBy: admin._id, pinned: true },
    { title: "Parent-Teacher Meeting", body: "PTM for Grade 8 and 9 is scheduled. Please check individual class timings.", audience: "parents", postedBy: admin._id },
    { title: "Staff Meeting", body: "Monthly staff meeting in the conference room.", audience: "teachers", postedBy: admin._id },
  ]);

  console.log("Creating timetable for Grade 8-A...");
  const slots = [
    ["Monday", 1, "Math", "09:00", "09:45"],
    ["Monday", 2, "Science", "09:45", "10:30"],
    ["Monday", 3, "English", "10:45", "11:30"],
    ["Tuesday", 1, "History", "09:00", "09:45"],
    ["Tuesday", 2, "Math", "09:45", "10:30"],
    ["Wednesday", 1, "Science", "09:00", "09:45"],
  ];
  for (const [day, period, subject, startTime, endTime] of slots) {
    await TimetableSlot.create({ schoolClass: grade8A._id, day, period, subject, startTime, endTime, teacher: teacher1._id });
  }

  console.log("Creating CRM admission leads...");
  await Lead.create([
    {
      childName: "Ishaan Verma",
      interestedGrade: "Grade 6",
      guardianName: "Neha Verma",
      phone: "9812345670",
      email: "neha.v@mail.com",
      source: "website",
      stage: "new",
      ownerStaff: admin._id,
      nextFollowUp: new Date(Date.now() + 2 * 86400000),
      activities: [{ type: "note", text: "Enquiry submitted via website contact form", createdBy: admin._id }],
    },
    {
      childName: "Zara Khan",
      interestedGrade: "Grade 3",
      guardianName: "Imran Khan",
      phone: "9812345671",
      source: "referral",
      stage: "contacted",
      ownerStaff: admin._id,
      nextFollowUp: new Date(Date.now() + 1 * 86400000),
      activities: [
        { type: "note", text: "Referred by an existing parent", createdBy: admin._id },
        { type: "call", text: "Called guardian, discussed grade fit", createdBy: admin._id },
      ],
    },
    {
      childName: "Yusuf Ali",
      interestedGrade: "Grade 1",
      guardianName: "Fatima Ali",
      phone: "9812345672",
      source: "walk_in",
      stage: "visit_scheduled",
      ownerStaff: admin._id,
      nextFollowUp: new Date(Date.now() - 1 * 86400000), // overdue, for the alert demo
      activities: [{ type: "visit", text: "Campus visit scheduled for this weekend", createdBy: admin._id }],
    },
    {
      childName: "Anaya Pillai",
      interestedGrade: "Grade 5",
      guardianName: "Suresh Pillai",
      phone: "9812345673",
      source: "event",
      stage: "application_submitted",
      ownerStaff: admin._id,
      activities: [{ type: "note", text: "Application form submitted, awaiting document verification", createdBy: admin._id }],
    },
    {
      childName: "Kabir Malhotra",
      interestedGrade: "Grade 4",
      guardianName: "Simran Malhotra",
      phone: "9812345674",
      source: "social_media",
      stage: "enrolled",
      ownerStaff: admin._id,
      activities: [{ type: "note", text: "Enrolled and admission fee paid", createdBy: admin._id }],
    },
    {
      childName: "Rohan Das",
      interestedGrade: "Grade 7",
      guardianName: "Bimal Das",
      phone: "9812345675",
      source: "phone",
      stage: "lost",
      lostReason: "Chose a school closer to home",
      ownerStaff: admin._id,
      activities: [{ type: "note", text: "Family decided on a different school due to distance", createdBy: admin._id }],
    },
  ]);

  console.log("\nSeed complete. Demo logins (password shown):");
  console.log("  Admin    -> admin@school.io / admin123");
  console.log("  Teacher  -> teacher@school.io / teacher123  (Rahul Verma, Grade 8-A)");
  console.log("  Teacher  -> priya@school.io / teacher123   (Priya Nair, Grade 9-B)");
  console.log("  Student  -> arjun@school.io / student123");
  console.log("  Parent   -> arjun.parent@mail.com / parent123");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
