md cert
openssl genrsa -out cert/key.pem 2028
openssl req -new -key cert/key.pem -out cert/csr.pem
openssl x509 -req -days 365 -in cert/csr.pem -signkey cert/key.pem -out cert/cert.pem