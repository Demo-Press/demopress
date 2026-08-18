ARG WORDPRESS_IMAGE=wordpress:7.0.3-php8.3-apache
FROM ${WORDPRESS_IMAGE}

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates mariadb-client tar gzip unzip less \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp \
 && chmod +x /usr/local/bin/wp

COPY wp-content/plugins/demopress-agent /usr/src/wordpress/wp-content/plugins/demopress-agent
COPY setup/finalise-clone.sh /usr/local/bin/finalise-clone.sh
COPY setup/personalise.php /usr/local/share/demopress/personalise.php
COPY setup/demopress-entrypoint.sh /usr/local/bin/demopress-entrypoint.sh
COPY config/php/wordpress.ini /usr/local/etc/php/conf.d/wordpress.ini
COPY security.conf /etc/apache2/conf-enabled/demopress-security.conf

RUN chmod +x /usr/local/bin/finalise-clone.sh /usr/local/bin/demopress-entrypoint.sh

ENTRYPOINT ["demopress-entrypoint.sh"]
CMD ["apache2-foreground"]
