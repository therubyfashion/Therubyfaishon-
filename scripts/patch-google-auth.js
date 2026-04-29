import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'node_modules', '@codetrix-studio', 'capacitor-google-auth', 'android', 'build.gradle');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('jcenter()')) {
    console.log('Patching capacitor-google-auth build.gradle...');
    content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
    fs.writeFileSync(filePath, content);
    console.log('Successfully patched!');
  } else {
    console.log('File already patched or jcenter() not found.');
  }
} else {
  console.log('File not found:', filePath);
}
