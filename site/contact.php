<?php
/**
 * Tokyo Copyright — contact form handler for cPanel / WHM (Apache + PHP).
 *
 * Drop this in the same directory as contact.html. The front-end posts JSON here
 * and expects {"ok":true} or {"ok":false,"error":"..."} back.
 *
 * Configure the two constants below, then test by submitting the form.
 * If PHP mail() is disabled on the server, set USE_SMTP_RELAY handling in your
 * host's control panel or point MAIL_TO at a mailbox on the same cPanel account —
 * mail() to a local mailbox is the most reliable option on shared hosting.
 */

declare(strict_types=1);

const MAIL_TO      = 'legal@tokyocopyright.com';
const MAIL_FROM    = 'website@tokyocopyright.com';   // must be a mailbox on THIS domain
const SITE_NAME    = 'Tokyo Copyright';
const MAX_BODY     = 20000;                          // bytes accepted from the client
const RATE_SECONDS = 20;                             // min seconds between sends per IP

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail(string $message, int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail('Method not allowed.', 405);
}

/* ---- Read the payload (JSON from fetch, or a plain form post) ------------- */
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw !== false && strlen($raw) > MAX_BODY) {
    fail('Message too large.', 413);
}

$data = [];
if (is_string($raw) && $raw !== '' && str_contains((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'json')) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}
if (!$data) {
    $data = $_POST;
}

function field(array $data, string $key, int $max = 500): string
{
    $value = isset($data[$key]) && is_scalar($data[$key]) ? (string) $data[$key] : '';
    $value = str_replace(["\r", "\0"], '', trim($value));
    return mb_substr($value, 0, $max);
}

/* ---- Honeypot: pretend success, send nothing ----------------------------- */
if (field($data, 'website') !== '') {
    echo json_encode(['ok' => true]);
    exit;
}

$name    = field($data, 'name', 120);
$company = field($data, 'company', 160);
$email   = field($data, 'email', 200);
$phone   = field($data, 'phone', 60);
$subject = field($data, 'subject', 80);
$rights  = field($data, 'rights', 80);
$message = field($data, 'message', 8000);
$consent = field($data, 'consent', 10);

if ($name === '' || $email === '' || $message === '') {
    fail('Please complete the name, email and message fields.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('That email address does not look valid.', 422);
}
if ($consent === '') {
    fail('Please confirm the privacy consent checkbox.', 422);
}
if (mb_strlen($message) < 10) {
    fail('Please add a little more detail to your message.', 422);
}

/* ---- Naive per-IP rate limit -------------------------------------------- */
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$stamp = sys_get_temp_dir() . '/tc-contact-' . sha1($ip);
if (is_file($stamp) && (time() - (int) filemtime($stamp)) < RATE_SECONDS) {
    fail('Please wait a moment before sending another message.', 429);
}
@touch($stamp);

/* ---- Compose ------------------------------------------------------------- */
$subjectLine = sprintf(
    '[%s] %s — %s',
    SITE_NAME,
    $subject !== '' ? $subject : 'Website enquiry',
    $company !== '' ? $company : $name
);

$body = implode("\n", [
    'A new enquiry was submitted on ' . SITE_NAME . '.',
    '',
    'Name:         ' . $name,
    'Company:      ' . ($company !== '' ? $company : '—'),
    'Email:        ' . $email,
    'Phone:        ' . ($phone !== '' ? $phone : '—'),
    'Reason:       ' . ($subject !== '' ? $subject : '—'),
    'Content type: ' . ($rights !== '' ? $rights : '—'),
    '',
    '--- Message ---',
    $message,
    '',
    '---',
    'IP:        ' . $ip,
    'Received:  ' . gmdate('Y-m-d H:i:s') . ' UTC',
    'User agent: ' . mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? '—'), 0, 300),
]);

/* Header injection is prevented by stripping CR/LF in field() above. */
$headers = implode("\r\n", [
    'From: ' . SITE_NAME . ' Website <' . MAIL_FROM . '>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: PHP/' . PHP_VERSION,
]);

$sent = @mail(MAIL_TO, '=?UTF-8?B?' . base64_encode($subjectLine) . '?=', $body, $headers, '-f' . MAIL_FROM);

if (!$sent) {
    error_log('[tokyocopyright] contact form: mail() failed for ' . $email);
    fail('The message could not be sent. Please email ' . MAIL_TO . ' directly.', 500);
}

echo json_encode(['ok' => true]);
