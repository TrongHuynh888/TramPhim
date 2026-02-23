/**
 * ============================================
 * WEB3 CONFIGURATION - Cronos Chain & CRO Token
 * ============================================
 *
 * HƯỚNG DẪN THIẾT LẬP METAMASK CHO CRONOS:
 *
 * 1. Mở Metamask -> Settings -> Networks -> Add Network
 * 2. Điền thông tin:
 *    - Network Name: Cronos Mainnet
 *    - RPC URL: https://evm.cronos.org
 *    - Chain ID: 25
 *    - Symbol: CRO
 *    - Block Explorer: https://cronoscan.com
 *
 * Hoặc cho Testnet:
 *    - Network Name: Cronos Testnet
 *    - RPC URL: https://evm-t3.cronos.org
 *    - Chain ID: 338
 *    - Symbol: tCRO
 *    - Block Explorer: https://testnet.cronoscan.com
 */

// ============================================
// CRONOS NETWORK CONFIG
// ============================================
const CRONOS_MAINNET = {
  chainId: "0x19", // 25 in hex
  chainName: "Cronos Mainnet",
  nativeCurrency: {
    name: "Cronos",
    symbol: "CRO",
    decimals: 18,
  },
  rpcUrls: ["https://evm.cronos.org"],
  blockExplorerUrls: ["https://cronoscan.com"],
};

const CRONOS_TESTNET = {
  chainId: "0x152", // 338 in hex
  chainName: "Cronos Testnet",
  nativeCurrency: {
    name: "Cronos Test",
    symbol: "tCRO",
    decimals: 18,
  },
  rpcUrls: ["https://evm-t3.cronos.org"],
  blockExplorerUrls: ["https://testnet.cronoscan.com"],
};

// Sử dụng Testnet cho development, đổi sang MAINNET khi production
const CURRENT_NETWORK = CRONOS_TESTNET;

// ============================================
// ĐỊA CHỈ VÍ NHẬN THANH TOÁN
// ============================================
// QUAN TRỌNG: Thay đổi địa chỉ này thành ví của bạn
const RECEIVER_WALLET = "0x2eBf21538aF9d3AA498f7E0b081A80ea820b96c0";

// ============================================
// WEB3 STATE
// ============================================
let provider = null;
let signer = null;
let userAddress = null;
let isConnected = false;

// ============================================
// KIỂM TRA METAMASK
// ============================================
function checkMetamask() {
  if (typeof window.ethereum !== "undefined") {
    console.log("✅ Metamask đã được cài đặt!");
    return true;
  } else {
    console.log("❌ Vui lòng cài đặt Metamask!");
    return false;
  }
}

// ============================================
// KẾT NỐI METAMASK
// ============================================
async function connectWallet() {
  if (!checkMetamask()) {
    showNotification("Vui lòng cài đặt Metamask để tiếp tục!", "error");
    window.open("https://metamask.io/download/", "_blank");
    return null;
  }

  try {
    // Yêu cầu kết nối tài khoản
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (accounts.length > 0) {
      userAddress = accounts[0];

      // Khởi tạo ethers provider và signer
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();

      // Chuyển sang mạng Cronos nếu cần
      await switchToCronos();

      isConnected = true;
      console.log("✅ Đã kết nối ví:", userAddress);

      // Cập nhật UI
      updateWalletUI();

      return userAddress;
    }
  } catch (error) {
    console.error("❌ Lỗi kết nối ví:", error);
    showNotification("Không thể kết nối ví. Vui lòng thử lại!", "error");
    return null;
  }
}

// ============================================
// CHUYỂN SANG MẠNG CRONOS
// ============================================
async function switchToCronos() {
  try {
    // Thử chuyển sang Cronos
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CURRENT_NETWORK.chainId }],
    });
    console.log("✅ Đã chuyển sang mạng Cronos");
  } catch (switchError) {
    // Nếu mạng chưa được thêm, thêm mới
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [CURRENT_NETWORK],
        });
        console.log("✅ Đã thêm mạng Cronos");
      } catch (addError) {
        console.error("❌ Không thể thêm mạng Cronos:", addError);
        throw addError;
      }
    } else {
      throw switchError;
    }
  }
}

// ============================================
// THANH TOÁN CRO
// ============================================
async function payWithCRO(amount, movieId, movieTitle) {
  console.log("🔄 Bắt đầu thanh toán:", amount, "CRO cho phim:", movieTitle);
  
  // Kiểm tra MetaMask trước
  if (!checkMetamask()) {
    showNotification("Vui lòng cài đặt Metamask để thanh toán!", "error");
    window.open("https://metamask.io/download/", "_blank");
    return null;
  }

  // Kiểm tra và kết nối ví nếu chưa kết nối
  if (!isConnected || !userAddress) {
    console.log("🔗 Đang kết nối ví MetaMask...");
    showNotification("Vui lòng kết nối ví MetaMask...", "info");
    
    const connected = await connectWallet();
    if (!connected) {
      showNotification("Không thể kết nối ví MetaMask!", "error");
      return null;
    }
  }

  try {
    // Hiển thị loading
    showPaymentLoading(true);
    showNotification("Đang tạo giao dịch...", "info");

    // Chuyển đổi số CRO sang Wei (18 decimals)
    const amountInWei = ethers.utils.parseEther(amount.toString());
    console.log("💰 Số tiền (Wei):", amountInWei.toString());

    // Tạo transaction
    console.log("📤 Đang gửi transaction đến:", RECEIVER_WALLET);
    const tx = await signer.sendTransaction({
      to: RECEIVER_WALLET,
      value: amountInWei,
    });

    console.log("📤 Transaction đã gửi:", tx.hash);
    showNotification("Transaction đã gửi! Vui lòng xác nhận trong MetaMask...", "info");

    // Đợi transaction được confirm
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("✅ Thanh toán thành công!");

      // Lưu transaction vào Firestore
      await saveTransaction(movieId, amount, tx.hash);

      // Cập nhật danh sách phim đã mua của user
      await updateUserPurchases(movieId);

      showPaymentLoading(false);
      showNotification(
        `Thanh toán thành công! Bạn đã mua vé xem "${movieTitle}"`,
        "success",
      );

      return tx.hash;
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    showPaymentLoading(false);
    console.error("❌ Lỗi thanh toán:", error);

    if (error.code === 4001) {
      showNotification("Bạn đã hủy giao dịch", "warning");
    } else if (error.code === -32603) {
      showNotification("Số dư không đủ để thanh toán", "error");
    } else if (error.message && error.message.includes("user rejected")) {
      showNotification("Bạn đã hủy giao dịch", "warning");
    } else {
      showNotification("Lỗi thanh toán. Vui lòng thử lại!", "error");
    }
    return null;
  }
}

// ============================================
// LƯU TRANSACTION VÀO FIRESTORE
// ============================================
async function saveTransaction(movieId, amount, txHash) {
  if (!db || !auth.currentUser) return;

  try {
    await db.collection("transactions").add({
      userId: auth.currentUser.uid,
      movieId: movieId,
      amount: amount,
      txHash: txHash,
      status: "completed",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    console.log("✅ Đã lưu transaction");
  } catch (error) {
    console.error("❌ Lỗi lưu transaction:", error);
  }
}

// ============================================
// CẬP NHẬT DANH SÁCH PHIM ĐÃ MUA
// ============================================
async function updateUserPurchases(movieId) {
  if (!db || !auth.currentUser) return;

  try {
    const userRef = db.collection("users").doc(auth.currentUser.uid);
    await userRef.update({
      purchasedMovies: firebase.firestore.FieldValue.arrayUnion(movieId),
    });
    console.log("✅ Đã cập nhật danh sách phim đã mua");
  } catch (error) {
    console.error("❌ Lỗi cập nhật purchases:", error);
  }
}

// ============================================
// KIỂM TRA ĐÃ MUA PHIM CHƯA
// ============================================
async function checkMoviePurchased(movieId) {
  if (!db || !auth.currentUser) return false;

  try {
    const userDoc = await db
      .collection("users")
      .doc(auth.currentUser.uid)
      .get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return (
        userData.purchasedMovies && userData.purchasedMovies.includes(movieId)
      );
    }
    return false;
  } catch (error) {
    console.error("❌ Lỗi kiểm tra purchase:", error);
    return false;
  }
}

// ============================================
// LẤY SỐ DƯ VÍ
// ============================================
async function getWalletBalance() {
  if (!provider || !userAddress) return "0";

  try {
    const balance = await provider.getBalance(userAddress);
    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error("❌ Lỗi lấy số dư:", error);
    return "0";
  }
}

// ============================================
// CẬP NHẬT UI VÍ (Đã nâng cấp nút Logout)
// ============================================
function updateWalletUI() {
  const walletBtn = document.getElementById("walletBtn");

  if (walletBtn && isConnected && userAddress) {
    // Hiển thị địa chỉ ví rút gọn
    walletBtn.innerHTML = `
      <i class="fas fa-wallet"></i>
      <span class="wallet-btn-text">${userAddress.substring(0, 6)}...${userAddress.substring(38)}</span>
      <i class="fas fa-sign-out-alt" style="margin-left: 5px; font-size: 12px;"></i>
    `;
    walletBtn.classList.add("connected");

    // 👉 QUAN TRỌNG: Khi click vào nút đã kết nối -> Hỏi đăng xuất
    walletBtn.onclick = async function () {
      if (await customConfirm("Bạn có muốn ngắt kết nối ví không?", { title: "Ngắt kết nối ví", type: "warning", confirmText: "Ngắt kết nối" })) {
        disconnectWallet();
      }
    };
  }
}

// ============================================
// LẮNG NGHE SỰ KIỆN METAMASK
// ============================================
if (typeof window.ethereum !== "undefined") {
  // Khi user đổi tài khoản
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length > 0) {
      userAddress = accounts[0];
      updateWalletUI();
      console.log("🔄 Đã đổi tài khoản:", userAddress);
    } else {
      isConnected = false;
      userAddress = null;
      location.reload();
    }
  });

  // Khi user đổi mạng
  window.ethereum.on("chainChanged", (chainId) => {
    console.log("🔄 Đã đổi mạng:", chainId);
    location.reload();
  });
}

// ============================================
// NGẮT KẾT NỐI VÍ (LOGOUT)
// ============================================
function disconnectWallet() {
  // 1. Xóa dữ liệu biến
  userAddress = null;
  isConnected = false;
  provider = null;
  signer = null;

  // 2. Reset giao diện nút bấm về ban đầu
  const walletBtn = document.getElementById("walletBtn");
  if (walletBtn) {
    walletBtn.innerHTML = '<i class="fas fa-wallet"></i><span class="wallet-btn-text">Kết nối ví</span>';
    walletBtn.classList.remove("connected");

    // Gán lại sự kiện click để kết nối lại
    walletBtn.onclick = connectWallet;
  }

  showNotification("Đã ngắt kết nối ví!", "info");
  console.log("❌ Đã ngắt kết nối ví");
}

// ============================================
// HIỂN THỊ LOADING THANH TOÁN
// ============================================
function showPaymentLoading(show) {
  // Tìm nút mua vé để hiển thị trạng thái loading
  const buyBtn = document.getElementById("buyTicketBtn");
  if (!buyBtn) return;

  if (show) {
    buyBtn.disabled = true;
    buyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
  } else {
    buyBtn.disabled = false;
    buyBtn.innerHTML = '<i class="fas fa-ticket-alt"></i> Mua Vé Ngay';
  }
}

// Export thêm hàm này để dùng được bên ngoài
window.disconnectWallet = disconnectWallet;

// Export functions
window.connectWallet = connectWallet;
window.payWithCRO = payWithCRO;
window.checkMoviePurchased = checkMoviePurchased;
window.getWalletBalance = getWalletBalance;
window.RECEIVER_WALLET = RECEIVER_WALLET;
window.CURRENT_NETWORK = CURRENT_NETWORK;
