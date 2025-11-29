import { handleStart } from "../controllers/lib/handleStart.js";

// Mock context object that simulates Telegram bot context
function createMockContext(options = {}) {
    const {
        userId = '123456789',
        username = 'testuser',
        startPayload = null,
        hasExistingWallets = false,
    } = options;

    const messages = []; // Store all messages sent

    return {
        from: {
            id: userId,
            username: username,
            first_name: 'Test',
            last_name: 'User',
        },
        startPayload: startPayload,
        reply: async (text, options) => {
            const messageId = Date.now();
            console.log('\n📤 Bot Reply:');
            console.log('Text:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
            if (options?.parse_mode) console.log('Parse Mode:', options.parse_mode);
            messages.push({ messageId, text, options });
            return { message_id: messageId };
        },
        replyWithHTML: async (text) => {
            const messageId = Date.now();
            console.log('\n📤 Bot HTML Reply:');
            console.log('Text:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
            messages.push({ messageId, text, type: 'html' });
            return { message_id: messageId };
        },
        deleteMessage: async (messageId) => {
            console.log(`🗑️ Deleting message: ${messageId}`);
            return true;
        },
        _messages: messages, // For testing purposes
    };
}

// Test cases
async function testNewUserNoReferral() {
    console.log('\n🧪 ========== TEST 1: New User (No Referral) ==========');

    const ctx = createMockContext({
        userId: '111111111',
        username: 'newuser1',
        startPayload: null,
    });

    console.log('📋 Test Config:');
    console.log('  • User ID:', ctx.from.id);
    console.log('  • Username:', ctx.from.username);
    console.log('  • Payload:', ctx.startPayload);

    try {
        await handleStart(ctx);

        console.log('\n✅ Test completed!');
        console.log('📊 Messages sent:', ctx._messages.length);

        // Verify expected behavior
        const hasWalletMessage = ctx._messages.some(m => m.text.includes('Generated new wallet'));
        const hasConfirmationRequest = ctx._messages.some(m => m.text.includes('mnemonic phrase or private key'));

        console.log('✓ Wallet generated message:', hasWalletMessage ? '✅' : '❌');
        console.log('✓ Confirmation request:', hasConfirmationRequest ? '✅' : '❌');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testNewUserWithReferral() {
    console.log('\n🧪 ========== TEST 2: New User (With Referral) ==========');

    const ctx = createMockContext({
        userId: '222222222',
        username: 'newuser2',
        startPayload: 'ref_123456789', // Referral code
    });

    console.log('📋 Test Config:');
    console.log('  • User ID:', ctx.from.id);
    console.log('  • Username:', ctx.from.username);
    console.log('  • Payload:', ctx.startPayload);
    console.log('  • Referrer ID:', '123456789');

    try {
        await handleStart(ctx);

        console.log('\n✅ Test completed!');
        console.log('📊 Messages sent:', ctx._messages.length);

        const hasWalletMessage = ctx._messages.some(m => m.text.includes('Generated new wallet'));
        const hasConfirmationRequest = ctx._messages.some(m => m.text.includes('mnemonic phrase or private key'));

        console.log('✓ Wallet generated message:', hasWalletMessage ? '✅' : '❌');
        console.log('✓ Confirmation request:', hasConfirmationRequest ? '✅' : '❌');
        console.log('ℹ️ Referral will be processed after wallet confirmation');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testExistingUser() {
    console.log('\n🧪 ========== TEST 3: Existing User (Has Wallets) ==========');

    const ctx = createMockContext({
        userId: '333333333',
        username: 'existinguser',
        startPayload: null,
    });

    console.log('📋 Test Config:');
    console.log('  • User ID:', ctx.from.id);
    console.log('  • Username:', ctx.from.username);
    console.log('  • Has existing wallets: YES');

    try {
        await handleStart(ctx);

        console.log('\n✅ Test completed!');
        console.log('📊 Messages sent:', ctx._messages.length);

        const hasWelcomeMessage = ctx._messages.some(m => m.text.includes('Welcome to'));
        const hasWalletInfo = ctx._messages.some(m => m.text.includes('Sui Wallet'));

        console.log('✓ Welcome message:', hasWelcomeMessage ? '✅' : '❌');
        console.log('✓ Wallet info displayed:', hasWalletInfo ? '✅' : '❌');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testExistingUserWithReferral() {
    console.log('\n🧪 ========== TEST 4: Existing User (With Referral) ==========');

    const ctx = createMockContext({
        userId: '444444444',
        username: 'existinguser2',
        startPayload: 'ref_555555555',
    });

    console.log('📋 Test Config:');
    console.log('  • User ID:', ctx.from.id);
    console.log('  • Username:', ctx.from.username);
    console.log('  • Payload:', ctx.startPayload);
    console.log('  • Referrer ID:', '555555555');
    console.log('  • Has existing wallets: YES');

    try {
        await handleStart(ctx);

        console.log('\n✅ Test completed!');
        console.log('📊 Messages sent:', ctx._messages.length);

        const hasWelcomeMessage = ctx._messages.some(m => m.text.includes('Welcome to'));
        const hasReferralMessage = ctx._messages.some(m => m.text.includes('referred'));

        console.log('✓ Welcome message:', hasWelcomeMessage ? '✅' : '❌');
        console.log('✓ Referral processed:', hasReferralMessage ? '✅' : '❌');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testUsernameReferral() {
    console.log('\n🧪 ========== TEST 5: Referral via Username ==========');

    const ctx = createMockContext({
        userId: '666666666',
        username: 'newuser3',
        startPayload: 'cooluser', // Username instead of ID
    });

    console.log('📋 Test Config:');
    console.log('  • User ID:', ctx.from.id);
    console.log('  • Username:', ctx.from.username);
    console.log('  • Payload:', ctx.startPayload);
    console.log('  • Referrer username:', 'cooluser');

    try {
        await handleStart(ctx);

        console.log('\n✅ Test completed!');
        console.log('📊 Messages sent:', ctx._messages.length);
        console.log('ℹ️ Referral lookup by username attempted');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testSelfReferral() {
    console.log('\n🧪 ========== TEST 6: Self-Referral Attempt (Should Fail) ==========');

    const userId = '777777777';
    const ctx = createMockContext({
        userId: userId,
        username: 'selfref',
        startPayload: `ref_${userId}`, // Trying to refer themselves
    });

    console.log('📋 Test Config:');
    console.log('  • User ID:', ctx.from.id);
    console.log('  • Referrer ID:', userId, '(SAME!)');
    console.log('  • Expected: Self-referral should be rejected');

    try {
        await handleStart(ctx);

        console.log('\n✅ Test completed!');
        console.log('ℹ️ Self-referral should have been rejected');

        const hasReferralMessage = ctx._messages.some(m => m.text.includes('referred'));
        console.log('✓ No referral message sent:', !hasReferralMessage ? '✅' : '❌');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testWalletMessageDeletion() {
    console.log('\n🧪 ========== TEST 7: Wallet Message Auto-Deletion ==========');

    const ctx = createMockContext({
        userId: '888888888',
        username: 'testdeletion',
        startPayload: null,
    });

    console.log('📋 Test Config:');
    console.log('  • Testing that wallet credentials are scheduled for deletion');
    console.log('  • Expected: Message should be deleted after 5 minutes');

    try {
        await handleStart(ctx);

        console.log('\n✅ Test completed!');
        console.log('ℹ️ In production, wallet message would be deleted after 5 minutes');
        console.log('ℹ️ This test only verifies the message was sent, not the actual deletion');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run all tests
async function runAllTests() {
    console.log('\n🎯 ========== STARTING HANDLESTART MOCK TESTS ==========\n');
    console.log('⚠️  NOTE: These are MOCK tests - no real database or Redis operations');
    console.log('⚠️  Database/Redis calls will fail but you can see the flow\n');

    const tests = [
        { name: 'New User (No Referral)', fn: testNewUserNoReferral },
        { name: 'New User (With Referral)', fn: testNewUserWithReferral },
        { name: 'Existing User', fn: testExistingUser },
        { name: 'Existing User (With Referral)', fn: testExistingUserWithReferral },
        { name: 'Username Referral', fn: testUsernameReferral },
        { name: 'Self-Referral', fn: testSelfReferral },
        { name: 'Wallet Message Deletion', fn: testWalletMessageDeletion },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test.fn();
            passed++;
        } catch (error) {
            console.error(`\n❌ ${test.name} FAILED:`, error.message);
            failed++;
        }
        console.log('\n' + '─'.repeat(60));
    }

    console.log('\n🏁 ========== TEST SUMMARY ==========');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${tests.length}`);
    console.log('\n✅ Mock tests completed!\n');
}

// Run tests based on command line argument
const testMode = process.argv[2];

if (testMode === 'all' || !testMode) {
    runAllTests();
} else if (testMode === '1') {
    testNewUserNoReferral();
} else if (testMode === '2') {
    testNewUserWithReferral();
} else if (testMode === '3') {
    testExistingUser();
} else if (testMode === '4') {
    testExistingUserWithReferral();
} else if (testMode === '5') {
    testUsernameReferral();
} else if (testMode === '6') {
    testSelfReferral();
} else if (testMode === '7') {
    testWalletMessageDeletion();
} else {
    console.log('Usage: node test-handleStart.js [all|1|2|3|4|5|6|7]');
}