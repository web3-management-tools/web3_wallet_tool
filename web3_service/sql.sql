CREATE TABLE `wallet`
(
    `id`          int(11) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `index`       int(11) DEFAULT NULL,
    `address`     varchar(100) DEFAULT NULL COMMENT '钱包地址',
    `public_key`  varchar(255) DEFAULT NULL COMMENT '公钥，starknet需要',
    `private_key` varchar(255) DEFAULT NULL COMMENT '私钥',
    `phrase`      varchar(255) DEFAULT NULL COMMENT '短语',
    `project`     varchar(50)  DEFAULT NULL COMMENT '项目',
    `remark`      varchar(50)  DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='钱包';


CREATE TABLE `wallet_mapping`
(
    `id`           int(11)      NOT NULL AUTO_INCREMENT COMMENT 'id',
    `source_address` varchar(100) NOT NULL COMMENT '源地址',
    `target_address` varchar(100) NOT NULL COMMENT '目标地址',
    `project`      varchar(50)   DEFAULT NULL COMMENT '项目',
    `remark`       varchar(100)  DEFAULT NULL COMMENT '备注',
    `created_at`   timestamp     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`   timestamp     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_source_address` (`source_address`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='钱包一对一映射';

CREATE TABLE `exchange_info`
(
    `id`       int(11) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `platform` varchar(20)  DEFAULT NULL COMMENT '平台，binance,okx,bitget',
    `apikey`   varchar(200) DEFAULT NULL COMMENT 'apikey',
    `secret`   varchar(200) DEFAULT NULL COMMENT 'secret',
    `password` varchar(100) DEFAULT NULL COMMENT 'password',
    `ip`       varchar(100) DEFAULT NULL COMMENT 'password',
    `name` varchar(50) DEFAULT NULL COMMENT '名字，多交易所时，用此字段区分',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='交易所配置';
