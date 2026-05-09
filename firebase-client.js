import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const config = window.EMOTION_HOTEL_FIREBASE_CONFIG || {};
const adminEmails = window.EMOTION_HOTEL_ADMIN_EMAILS || [];
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

function sanitize(value, maxLength = 240) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hotelRef(hotelId) {
  return doc(db, "hotels", hotelId);
}

function roomsRef(hotelId) {
  return collection(db, "hotels", hotelId, "rooms");
}

function roomRef(hotelId, roomId) {
  return doc(db, "hotels", hotelId, "rooms", roomId);
}

function feedbacksRef(hotelId, roomId) {
  return collection(db, "hotels", hotelId, "rooms", roomId, "feedbacks");
}

function mapHotel(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    name: data.name || ""
  };
}

function mapRoom(docSnap) {
  const data = docSnap.data() || {};
  return {
    roomId: docSnap.id,
    guestName: data.guestName || "",
    mood: data.mood || "",
    message: data.message || "",
    roomColor: data.roomColor || "sakura",
    decor: data.decor || "simple",
    floor: Math.max(1, Number(data.floor) || 1),
    feedbackCount: Number(data.feedbackCount) || 0
  };
}

function mapFeedback(docSnap) {
  const data = docSnap.data() || {};
  return {
    senderName: data.senderName || "",
    feedbackText: data.feedbackText || ""
  };
}

function sortRooms(rooms) {
  return rooms.sort((a, b) => {
    const floorDiff = Number(b.floor || 1) - Number(a.floor || 1);
    return floorDiff || String(a.guestName || "").localeCompare(String(b.guestName || ""), "zh-Hant");
  });
}

async function ensureTeacher() {
  if (auth.currentUser && adminEmails.includes(auth.currentUser.email || "")) {
    return true;
  }
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  const email = result.user?.email || "";
  if (!adminEmails.includes(email)) {
    await signOut(auth);
    throw new Error("這個 Google 帳號沒有教師權限。");
  }
  return true;
}

async function createHotel(name, theme, decor, passcode) {
  await ensureTeacher();
  const safeName = sanitize(name, 80);
  const safePasscode = sanitize(passcode, 48);
  if (!safeName || !safePasscode) throw new Error("請填寫飯店名稱與課程密碼。");

  const hotelDoc = doc(collection(db, "hotels"));
  const passHash = await sha256Hex(safePasscode);
  const batch = writeBatch(db);
  batch.set(hotelDoc, {
    name: safeName,
    theme: sanitize(theme, 32) || "theme-modern",
    decor: sanitize(decor, 40) || "無",
    roomCount: 0,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(doc(db, "hotels", hotelDoc.id, "access", passHash), {
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return true;
}

async function getHotelList() {
  const snap = await getDocs(query(collection(db, "hotels"), orderBy("createdAt", "desc")));
  return snap.docs
    .filter(docSnap => !docSnap.data().archived && docSnap.data().name)
    .map(mapHotel);
}

async function verifyPasscode(hotelId, passcode) {
  const hotelSnap = await getDoc(hotelRef(hotelId));
  if (!hotelSnap.exists() || hotelSnap.data().archived) {
    return { success: false, msg: "課程密碼錯誤，或找不到該飯店。" };
  }

  const passHash = await sha256Hex(sanitize(passcode, 48));
  const accessSnap = await getDoc(doc(db, "hotels", hotelId, "access", passHash));
  if (!accessSnap.exists()) {
    return { success: false, msg: "課程密碼錯誤，或找不到該飯店。" };
  }

  const hotel = hotelSnap.data();
  return {
    success: true,
    hotelId,
    hotelName: hotel.name,
    color: hotel.theme || "theme-modern"
  };
}

async function checkInRoom(hotelId, guestName, mood, message, roomColor, decor, floor) {
  const safeName = sanitize(guestName, 24);
  const safeMood = sanitize(mood, 40);
  if (!safeName || !safeMood) throw new Error("請填寫名字並選擇心情。");

  await addDoc(roomsRef(hotelId), {
    guestName: safeName,
    mood: safeMood,
    message: sanitize(message, 180),
    roomColor: sanitize(roomColor, 32) || "sakura",
    decor: sanitize(decor, 32) || "simple",
    floor: Math.max(1, Math.min(30, Number(floor) || 1)),
    feedbackCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await updateDoc(hotelRef(hotelId), {
    roomCount: increment(1),
    updatedAt: serverTimestamp()
  });
  return true;
}

async function getHotelRooms(hotelId) {
  const snap = await getDocs(roomsRef(hotelId));
  return sortRooms(snap.docs.map(mapRoom));
}

function subscribeHotelRooms(hotelId, onNext, onError) {
  return onSnapshot(
    roomsRef(hotelId),
    snap => onNext(sortRooms(snap.docs.map(mapRoom))),
    onError
  );
}

async function getRoomFeedbacks(roomId, hotelId = window.__emotionHotelCurrentHotelId || "") {
  const snap = await getDocs(query(feedbacksRef(hotelId, roomId), orderBy("createdAt", "asc")));
  return snap.docs.map(mapFeedback);
}

async function addFeedback(roomId, senderName, feedbackText, hotelId = window.__emotionHotelCurrentHotelId || "") {
  const safeSender = sanitize(senderName, 20);
  const safeText = sanitize(feedbackText, 120);
  if (!safeSender || !safeText) throw new Error("請填寫署名與回饋內容。");

  await runTransaction(db, async tx => {
    tx.set(doc(feedbacksRef(hotelId, roomId)), {
      senderName: safeSender,
      feedbackText: safeText,
      createdAt: serverTimestamp()
    });
    tx.update(roomRef(hotelId, roomId), {
      feedbackCount: increment(1),
      updatedAt: serverTimestamp()
    });
  });
  return true;
}

async function verifyMasterAdmin() {
  try {
    await ensureTeacher();
    return true;
  } catch (error) {
    return false;
  }
}

async function deleteHotel(hotelId) {
  const userEmail = auth.currentUser?.email || "";
  if (!adminEmails.includes(userEmail)) throw new Error("這個帳號沒有總管權限。");

  const roomsSnap = await getDocs(roomsRef(hotelId));
  for (const roomDoc of roomsSnap.docs) {
    const feedbackSnap = await getDocs(feedbacksRef(hotelId, roomDoc.id));
    const feedbackBatch = writeBatch(db);
    feedbackSnap.docs.forEach(feedbackDoc => feedbackBatch.delete(feedbackDoc.ref));
    feedbackBatch.delete(roomDoc.ref);
    await feedbackBatch.commit();
  }
  await updateDoc(hotelRef(hotelId), {
    archived: true,
    updatedAt: serverTimestamp()
  });
  return true;
}

window.emotionHotelApi = {
  addFeedback,
  checkInRoom,
  createHotel,
  deleteHotel,
  getHotelList,
  getHotelRooms,
  getRoomFeedbacks,
  subscribeHotelRooms,
  verifyMasterAdmin,
  verifyPasscode
};
