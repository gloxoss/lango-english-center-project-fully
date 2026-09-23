async function main() {
  // Let's call the API endpoint locally or check the code
  const res = await fetch('http://localhost:3222/api/students/photos', {
    headers: {
      // We need session cookie or test directly
    }
  });
  console.log('Status without auth:', res.status);
}
main().catch(console.error);
