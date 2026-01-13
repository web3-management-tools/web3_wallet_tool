# coding:utf-8
'''
Author: llq
le: response_invoke.PY
Date: 2024/7/13-15:38
'''
import json


def resp_invoke_ok(data):
    resp = {
        "code": 20000,
        "data": data,
        "msg": "ok"
    }

    return resp


def resp_invoke_fail(msg):
    resp = {
        "code": -1,
        "data": None,
        "msg": msg
    }
    return resp
