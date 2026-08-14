const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'routes/stats.js');
let content = fs.readFileSync(filePath, 'utf8');

const replacement = `
    const byPlatform = Object.values(platformStats);

    const logsSnap = await db.collection('logs')
      .where('user_id', '==', uid)
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
      
    const recentLogs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const accSnap = await db.collection('social_accounts')
      .where('user_id', '==', uid)
      .where('is_active', '==', true)
      .get();

    res.json({ 
      summary, 
      byPlatform, 
      recent, 
      recentLogs,
      activeAccounts: accSnap.size
    });
  } catch (err) {
`;

// we replace from "const byPlatform" to "} catch (err) {"
const startStr = "    const byPlatform = Object.values(platformStats);";
const endStr = "  } catch (err) {";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex + endStr.length);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully patched stats.js");
} else {
  console.log("Could not find the target string in stats.js");
}
