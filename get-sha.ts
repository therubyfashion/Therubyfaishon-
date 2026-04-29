
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

try {
  const androidPath = path.join(process.cwd(), 'android');
  const gradlewPath = path.join(androidPath, 'gradlew');
  
  // Fix permissions
  console.log('Fixing permissions for:', gradlewPath);
  fs.chmodSync(gradlewPath, '755');

  console.log('Running signing report in:', androidPath);
  const output = execSync('./gradlew signingReport', { cwd: androidPath, encoding: 'utf8' });
  console.log(output);
} catch (error) {
  console.error('Error running signing report:', error.message);
  if (error.stdout) console.log(error.stdout);
  if (error.stderr) console.error(error.stderr);
}
