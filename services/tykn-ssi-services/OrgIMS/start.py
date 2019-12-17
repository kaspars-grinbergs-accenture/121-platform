import asyncio

import logging
from logging.handlers import RotatingFileHandler

from orgims import Service, Config

from argparse import ArgumentParser
parser = ArgumentParser()
parser.add_argument("-c", "--config", dest="config",
                    help="Specify config-file", metavar="FILE")
args = parser.parse_args()

svc = None

async def setup():
    global svc

    log_formatter = logging.Formatter('%(asctime)s %(levelname)s %(funcName)s(%(lineno)d) %(message)s')
    log_file = '/var/log/orgims/orgims.log'
    log_file_size = 2*1024*1024*1024 # 2 GB
    file_handler = RotatingFileHandler(log_file, mode='a', maxBytes= log_file_size, backupCount=1, encoding=None, delay=0)
    file_handler.setFormatter(log_formatter)
    file_handler.setLevel(logging.DEBUG)

    service_logger = logging.getLogger('orgims')
    service_logger.addHandler(logging.StreamHandler())
    service_logger.addHandler(file_handler)
    service_logger.setLevel(logging.DEBUG)

    with open(args.config, 'r') as f:
        config_data = f.read()

    config = Config.load(config_data)
    loop = asyncio.get_event_loop()
    svc = Service(config, service_logger, loop)

    await svc.setup()

def run():
    svc.start()


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(setup())
    run()