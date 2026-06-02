const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.json') && !file.endsWith('manifest.json')) {
            results.push(file);
        }
    });
    return results;
}

function fixJson(content) {
    let fixed = content;

    // 1. Remove trailing content after the last closing brace or bracket
    const lastBrace = fixed.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < fixed.length - 1) {
        const trailing = fixed.substring(lastBrace + 1);
        if (trailing.trim().length > 0) {
            console.log('   Removing trailing content');
            fixed = fixed.substring(0, lastBrace + 1);
        }
    }

    // 2. Fix literal control characters (0x00-0x1F) except maybe common whitespace if we are careful.
    // Actually, JSON.parse strictly forbids them in strings.
    // Let's replace them globally first if they are not standard whitespace.
    // Wait, \n (0x0A) is a control char. If it's outside a string it's fine. If inside, it's not.
    // This is the core issue.

    // Let's replace all control chars that are NOT \n, \r, \t with nothing.
    fixed = fixed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    // Now handle \n and \r which might be inside strings.
    // We'll use a simpler state-based string parser to find content inside quotes.
    let output = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < fixed.length; i++) {
        let char = fixed[i];
        if (inString) {
            if (escaped) {
                output += char;
                escaped = false;
            } else if (char === '\\') {
                output += char;
                escaped = true;
            } else if (char === '"') {
                output += char;
                inString = false;
            } else if (char === '\n') {
                output += '\\n';
            } else if (char === '\r') {
                output += '\\r';
            } else if (char === '\t') {
                output += '\\t';
            } else {
                output += char;
            }
        } else {
            if (char === '"') {
                inString = true;
            }
            output += char;
        }
    }
    fixed = output;

    // 3. Fix unescaped backslashes inside strings
    // Now that we have handled literal newlines, we can use regex more safely or just another pass.
    output = '';
    inString = false;
    escaped = false;
    for (let i = 0; i < fixed.length; i++) {
        let char = fixed[i];
        if (inString) {
            if (escaped) {
                // Check if this is a valid escape
                if (!'\"\\/bfnrtu'.includes(char)) {
                    // It was an invalid escape like \A. We need to escape the backslash.
                    // So we want \\A in the final JSON.
                    // Current output has the first backslash. We just need to add another one before it.
                    output = output.slice(0, -1) + '\\\\' + char;
                } else {
                    output += char;
                }
                escaped = false;
            } else if (char === '\\') {
                output += char;
                escaped = true;
            } else if (char === '"') {
                output += char;
                inString = false;
            } else {
                output += char;
            }
        } else {
            if (char === '"') {
                inString = true;
            }
            output += char;
        }
    }
    fixed = output;

    // 4. Fix specific case: }, "id": (missing {)
    fixed = fixed.replace(/\},\s+"id":/g, '},\n    {\n      "id":');

    return fixed;
}

const files = walk(DATA_DIR);
let totalErrors = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    try {
        JSON.parse(content);
    } catch (e) {
        console.log(`Error in ${file}: ${e.message}`);

        let fixedContent = fixJson(content);

        try {
            const parsed = JSON.parse(fixedContent);
            fs.writeFileSync(file, JSON.stringify(parsed, null, 2), 'utf8');
            console.log(`   SUCCESSfully fixed and formatted ${file}`);
        } catch (e2) {
            console.log(`   FAILED to fix ${file} with basic fixes: ${e2.message}`);

            // Try aggressive quote escaping
            let moreFixed = fixedContent.replace(/(": ")(.*)(",?)$/gm, (m, p1, p2, p3) => {
                 return p1 + p2.replace(/(?<!\\)"/g, '\\"') + p3;
            });

            try {
                const parsed2 = JSON.parse(moreFixed);
                fs.writeFileSync(file, JSON.stringify(parsed2, null, 2), 'utf8');
                console.log(`   SUCCESSfully fixed (with aggressive quote escaping) ${file}`);
            } catch (e3) {
                console.log(`   STILL FAILED ${file}: ${e3.message}`);
                totalErrors++;
            }
        }
    }
});

if (totalErrors === 0) {
    console.log('All JSON files are valid (some may have been fixed)!');
} else {
    console.log(`Finished with ${totalErrors} errors remaining.`);
}
