FROM wordpress:6.8-php8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip less mariadb-client \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp \
 && chmod +x /usr/local/bin/wp \
 && wp --info --allow-root

COPY wp-content /var/www/html/wp-content
COPY setup /setup
COPY security.conf /etc/apache2/conf-available/demopress-security.conf

RUN sed -i 's/\r$//' /setup/*.sh \
 && a2enconf demopress-security \
 && chmod +x /setup/*.sh \
 && chown -R www-data:www-data /var/www/html/wp-content

EXPOSE 80
